import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './eventBus';

describe('EventBus', () => {
  it('publish to a topic with no subscribers is a no-op', () => {
    const bus = new EventBus();
    expect(() => bus.publish('untouched', { x: 1 })).not.toThrow();
  });

  it('a subscribed listener receives published payloads', () => {
    const bus = new EventBus();
    const received: number[] = [];
    bus.subscribe<number>('count', (n) => received.push(n));
    bus.publish('count', 1);
    bus.publish('count', 2);
    expect(received).toEqual([1, 2]);
  });

  it('multiple listeners on one topic fire in subscription order', () => {
    const bus = new EventBus();
    const order: string[] = [];
    bus.subscribe('t', () => order.push('A'));
    bus.subscribe('t', () => order.push('B'));
    bus.subscribe('t', () => order.push('C'));
    bus.publish('t', undefined);
    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('unsubscribe drops the listener from subsequent publishes', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    const off = bus.subscribe<number>('t', spy);
    bus.publish('t', 1);
    off();
    bus.publish('t', 2);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('unsubscribe is idempotent', () => {
    const bus = new EventBus();
    const spy = vi.fn();
    const off = bus.subscribe('t', spy);
    off();
    off();
    bus.publish('t', undefined);
    expect(spy).not.toHaveBeenCalled();
  });

  it('listenerCount tracks live subscribers per topic', () => {
    const bus = new EventBus();
    expect(bus.listenerCount('t')).toBe(0);
    const off = bus.subscribe('t', () => undefined);
    expect(bus.listenerCount('t')).toBe(1);
    off();
    expect(bus.listenerCount('t')).toBe(0);
  });

  it('clear(topic) drops subscribers for that topic only', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe('alpha', a);
    bus.subscribe('beta', b);
    bus.clear('alpha');
    bus.publish('alpha', 1);
    bus.publish('beta', 2);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledWith(2);
  });

  it('clear() with no topic drops everything', () => {
    const bus = new EventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe('alpha', a);
    bus.subscribe('beta', b);
    bus.clear();
    bus.publish('alpha', 1);
    bus.publish('beta', 2);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('topics() returns the active topic list', () => {
    const bus = new EventBus();
    bus.subscribe('alpha', () => undefined);
    bus.subscribe('beta', () => undefined);
    expect(new Set(bus.topics())).toEqual(new Set(['alpha', 'beta']));
  });

  it('a throwing listener propagates the error to the publisher', () => {
    const bus = new EventBus();
    bus.subscribe('boom', () => {
      throw new Error('listener failed');
    });
    expect(() => bus.publish('boom', undefined)).toThrow('listener failed');
  });
});
