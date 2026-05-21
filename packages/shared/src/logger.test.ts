import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogLevel, logger, setLogLevel } from './logger.js';

describe('logger', () => {
  beforeEach(() => {
    setLogLevel('debug');
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('setLogLevel / getLogLevel', () => {
    it('returns the current log level', () => {
      setLogLevel('warn');
      expect(getLogLevel()).toBe('warn');
    });

    it('defaults can be overridden', () => {
      setLogLevel('error');
      expect(getLogLevel()).toBe('error');
    });
  });

  describe('level filtering', () => {
    it('logs all levels when set to debug', () => {
      setLogLevel('debug');
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(console.debug).toHaveBeenCalledTimes(1);
      expect(console.info).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('suppresses debug when level is info', () => {
      setLogLevel('info');
      logger.debug('d');
      logger.info('i');
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).toHaveBeenCalledTimes(1);
    });

    it('suppresses debug and info when level is warn', () => {
      setLogLevel('warn');
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('only logs errors when level is error', () => {
      setLogLevel('error');
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledTimes(1);
    });

    it('logs nothing when level is silent', () => {
      setLogLevel('silent');
      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');
      expect(console.debug).not.toHaveBeenCalled();
      expect(console.info).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
    });
  });

  describe('output format', () => {
    it('debug includes prefix', () => {
      logger.debug('test message');
      expect(console.debug).toHaveBeenCalledWith('[FA:debug]', 'test message');
    });

    it('info passes args directly', () => {
      logger.info('hello', 'world');
      expect(console.info).toHaveBeenCalledWith('hello', 'world');
    });

    it('warn passes args directly', () => {
      logger.warn('caution');
      expect(console.warn).toHaveBeenCalledWith('caution');
    });

    it('error passes args directly', () => {
      logger.error('fail', { code: 1 });
      expect(console.error).toHaveBeenCalledWith('fail', { code: 1 });
    });
  });
});
