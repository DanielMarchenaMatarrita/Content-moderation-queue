import {
  DETERMINISTIC_MODERATION_ENGINE_VERSION,
  DeterministicModerationEngine,
  MODERATION_REASON,
} from './deterministic-moderation-engine.js';

describe('DeterministicModerationEngine', () => {
  const engine = new DeterministicModerationEngine();

  it('approves normal text without risk signals', () => {
    expect(engine.evaluate('A calm message about gardening.')).toEqual({
      decision: 'APPROVED',
      score: 0,
      reasons: [],
      engineVersion: 'deterministic-rules-v1',
    });
  });

  it('scores excessive links', () => {
    expect(
      engine.evaluate('http://a.test https://b.test https://c.test'),
    ).toMatchObject({
      decision: 'REVIEW_REQUIRED',
      score: 40,
      reasons: [MODERATION_REASON.excessiveLinks],
    });
  });

  it('detects consecutive repeated word spam after normalization', () => {
    expect(engine.evaluate('Buy BUY buy buy buy now').reasons).toContain(
      MODERATION_REASON.repetitiveWordSpam,
    );
  });

  it('detects character flooding', () => {
    expect(engine.evaluate('This is so coooooooooool').reasons).toContain(
      MODERATION_REASON.characterFlood,
    );
  });

  it('detects excessive uppercase only when enough letters exist', () => {
    expect(engine.evaluate('THIS MESSAGE IS EXTREMELY LOUD').reasons).toContain(
      MODERATION_REASON.excessiveUppercase,
    );
    expect(engine.evaluate('ÉSTE MENSAJE ESTÁ MUY ALTO').reasons).toContain(
      MODERATION_REASON.excessiveUppercase,
    );
    expect(engine.evaluate('LOUD').reasons).not.toContain(
      MODERATION_REASON.excessiveUppercase,
    );
  });

  it('caps combined signal score at 100', () => {
    const result = engine.evaluate(
      'BUY BUY BUY BUY BUY AAAAAAAAAA HTTP://A.TEST HTTPS://B.TEST HTTPS://C.TEST',
    );

    expect(result.score).toBe(100);
    expect(result.reasons).toHaveLength(4);
  });

  it('assigns REVIEW_REQUIRED at score 40', () => {
    expect(engine.evaluate('spam spam spam spam spam').decision).toBe(
      'REVIEW_REQUIRED',
    );
  });

  it('assigns REJECTED at score 70 or above', () => {
    expect(
      engine.evaluate(
        'spam spam spam spam spam http://a.test http://b.test http://c.test',
      ).decision,
    ).toBe('REJECTED');
  });

  it('returns identical evaluations for identical input', () => {
    const input = 'repeat repeat repeat repeat repeat';
    expect(engine.evaluate(input)).toEqual(engine.evaluate(input));
  });

  it('exposes a stable engine version', () => {
    expect(DETERMINISTIC_MODERATION_ENGINE_VERSION).toBe(
      'deterministic-rules-v1',
    );
    expect(engine.evaluate('normal text').engineVersion).toBe(
      DETERMINISTIC_MODERATION_ENGINE_VERSION,
    );
  });
});
