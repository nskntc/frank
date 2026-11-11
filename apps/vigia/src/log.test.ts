import { describe, expect, it } from 'vitest';
import { formatarLinha } from './log.js';

describe('formatarLinha', () => {
  it('poe hora ISO, nivel e mensagem', () => {
    const agora = new Date('2026-11-11T12:00:00.000Z');
    expect(formatarLinha('aviso', 'kiwi sem resposta', agora)).toBe(
      '2026-11-11T12:00:00.000Z [aviso] kiwi sem resposta',
    );
  });
});
