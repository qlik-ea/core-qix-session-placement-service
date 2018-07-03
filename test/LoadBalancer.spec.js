const Config = require('../src/Config');

describe('LoadBalancer', () => {
  let LoadBalancer;
  let prom;

  beforeEach(() => {
    LoadBalancer = require('../src/LoadBalancer'); // eslint-disable-line global-require
    prom = require('http-metrics-middleware').promClient; // eslint-disable-line global-require
  });

  afterEach(() => {
    delete require.cache[require.resolve('../src/LoadBalancer')];
    prom.register.clear();
    delete require.cache[require.resolve('http-metrics-middleware')];
  });

  describe('Round Robin', () => {
    it('should return undefined if no engines', () => {
      const engines = [];
      expect(LoadBalancer.roundRobin(engines)).to.equal(undefined);
    });

    it('should return the same engine if only one engine available', () => {
      const engines = [{ engine: { ip: '192.168.0.1' } }];
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[0]);
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[0]);
    });

    it('should go round robin on number of engines', () => {
      const engines = [
        { engine: { ip: '192.168.0.1' } },
        { engine: { ip: '192.168.0.2' } },
        { engine: { ip: '192.168.0.3' } },
        { engine: { ip: '192.168.0.4' } },
      ];
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[0]);
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[1]);
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[2]);
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[3]);
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[0]);
    });

    it('should return the first engine if the engines list decreases', () => {
      const engines = [
        { engine: { ip: '192.168.0.1' } },
        { engine: { ip: '192.168.0.2' } },
        { engine: { ip: '192.168.0.3' } },
        { engine: { ip: '192.168.0.4' } },
      ];
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[0]);
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[1]);

      const engines2 = [{ engine: { ip: '192.168.0.1' } }, { engine: { ip: '192.168.0.2' } }];
      expect(LoadBalancer.roundRobin(engines2)).to.equal(engines2[0]);
      expect(LoadBalancer.roundRobin(engines2)).to.equal(engines2[1]);
    });

    it('should return the next engine if the engines list increases', () => {
      const engines = [{ engine: { ip: '192.168.0.1' } }, { engine: { ip: '192.168.0.2' } }];
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[0]);
      expect(LoadBalancer.roundRobin(engines)).to.equal(engines[1]);

      const engines2 = [
        { engine: { ip: '192.168.0.1' } },
        { engine: { ip: '192.168.0.2' } },
        { engine: { ip: '192.168.0.3' } }];
      expect(LoadBalancer.roundRobin(engines2)).to.equal(engines2[2]);
      expect(LoadBalancer.roundRobin(engines2)).to.equal(engines2[0]);
    });
  });

  describe('Least Load', () => {
    it('should return undefined if no engines', () => {
      const engines = [];
      expect(LoadBalancer.leastLoad(engines)).to.equal(undefined);
    });

    it('should return the same engine if only one engine available', () => {
      const engines = [{ engine: { ip: '192.168.0.1', health: { mem: { free: 12313 }, cpu: { total: 12345 } } } }];

      const instance = LoadBalancer.leastLoad(engines);
      expect(instance.engine.ip).to.equal('192.168.0.1');

      const nextInstance = LoadBalancer.leastLoad(engines);
      expect(nextInstance.engine.ip).to.equal('192.168.0.1');
    });

    it('should return the engine with most free memory', () => {
      const engines = [
        { engine: { ip: '192.168.0.1', health: { mem: { free: 12313 }, cpu: { total: 12345 } } } },
        { engine: { ip: '192.168.0.2', health: { mem: { free: 12312 }, cpu: { total: 12342 } } } },
        { engine: { ip: '192.168.0.3', health: { mem: { free: 12316 }, cpu: { total: 12345 } } } },
        { engine: { ip: '192.168.0.4', health: { mem: { free: 12312 }, cpu: { total: 12341 } } } },
      ];

      const instance = LoadBalancer.leastLoad(engines);
      expect(instance.engine.ip).to.equal('192.168.0.3');

      const nextInstance = LoadBalancer.leastLoad(engines);
      expect(nextInstance.engine.ip).to.equal('192.168.0.3');
    });

    it('should return the engine with less cpu total if free memory is the same', () => {
      const engines = [
        { engine: { ip: '192.168.0.1', health: { mem: { free: 12312 }, cpu: { total: 12345 } } } },
        { engine: { ip: '192.168.0.2', health: { mem: { free: 12312 }, cpu: { total: 12342 } } } },
      ];

      const instance = LoadBalancer.leastLoad(engines);
      expect(instance.engine.ip).to.equal('192.168.0.2');
    });

    it('should return any engine if both memory free and cpu total is the same', () => {
      const engines = [
        { engine: { ip: '192.168.0.1', health: { mem: { free: 12312 }, cpu: { total: 12342 } } } },
        { engine: { ip: '192.168.0.2', health: { mem: { free: 12312 }, cpu: { total: 12342 } } } },
      ];

      const instance = LoadBalancer.leastLoad(engines);
      expect(instance.engine.health.mem.free).to.equal(12312);
    });
  });


  describe('Weighted Load', () => {
    beforeEach(() => { // Set max number of session per node
      process.env.SESSIONS_PER_ENGINE_THRESHOLD = 130;
      Config.init();
    });
    afterEach(() => { Config.sessionsPerEngineThreshold = undefined; });

    it('should return undefined if no engines', () => {
      const engines = [];
      expect(LoadBalancer.weightedLoad(engines)).to.equal(undefined);
    });

    it('should return the same engine if only one engine available', () => {
      const engines = [{ engine: { ip: '192.168.0.1', health: { mem: { free: 12313 }, cpu: { total: 12345 } } } }];

      const instance = LoadBalancer.weightedLoad(engines);
      expect(instance.engine.ip).to.equal('192.168.0.1');

      const nextInstance = LoadBalancer.weightedLoad(engines);
      expect(nextInstance.engine.ip).to.equal('192.168.0.1');
    });

    it('should return the engine with likelihood corresponding the amount of available session slots left', () => {
      const engines = require('./testdata.json'); // eslint-disable-line global-require
      const counters = {};
      // Since we are dealing with randomness run the algorithm a
      // few times and see where the rests converge.
      for (let i = 0; i < 10000; i += 1) {
        const chosen = LoadBalancer.weightedLoad(engines);
        if (chosen) {
          counters[chosen.engine.ip] = (counters[chosen.engine.ip] || 0) + 1;
        }
      }
      const actualRatio = counters['172.19.0.5'] / counters['172.19.0.4'];
      // Calculate the expected ratio. The 99 and 120 magic numbers below
      // reflect the qix_active_sessions values in the test data
      const expectedRatio = (Config.sessionsPerEngineThreshold - 99)
      / (Config.sessionsPerEngineThreshold - 120);
      expect(actualRatio).to.be.within(expectedRatio * 0.8, expectedRatio * 1.2);
    });
  });

  describe('Max Number of Sessions', () => {
    it('should remove engines that exceed max active sessions', () => {
      const engines = require('./testdata.json'); // eslint-disable-line global-require

      // Check number of engines returned without a max number set
      let instances = LoadBalancer.checkMaxSessions(engines);
      expect(instances.length).to.equal(2);

      // Set max number of session per node
      process.env.SESSIONS_PER_ENGINE_THRESHOLD = 100;
      Config.init();

      // Verify number of engines returned
      instances = LoadBalancer.checkMaxSessions(engines);
      expect(instances.length).to.equal(1);
    });
  });
});
