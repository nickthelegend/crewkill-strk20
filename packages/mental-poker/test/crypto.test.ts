import {
  privToPubKey,
  encrypt,
  remask,
  computeRevealToken,
  decryptWithTokens,
  computeAggregateKey,
  buildCardTable,
  lookupCard,
} from '../src/crypto/elgamal';
import {
  G,
  GRUMPKIN_P,
  fixedBaseMul,
  toPoint,
  fromPoint,
} from '../src/crypto/grumpkin';

// ──────────────────────────────────────────────────────────────
// Test vectors extracted from Noir circuits/shared/src/lib.nr
// by running `nargo test --show-output`
// ──────────────────────────────────────────────────────────────

const VECTORS = {
  // Generator G
  G: {
    x: 1n,
    y: 17631683881184975370165255887551781615748388533673675138860n,
  },
  // 42 * G
  pk42: {
    x: 7356913722468763155518092886238006860757299964193402191943647957243737021149n,
    y: 8353686781200727416994686754908207716480106082647483667993604622182232784267n,
  },
  // 7 * G
  pk7: {
    x: 6502298228793251914218452601347199200336821300374732886528232462753193470018n,
    y: 9407677376110273038006540221648729284102344671467345386528008239979586131147n,
  },
  // encrypt(pk7, card=5, r=13): C1=13*G, C2=5*G+13*pk7
  enc_c1: {
    x: 10809959749546906178108124392356959396802098006835953119519183102960228197747n,
    y: 19848177504612301803323686742266901953489175893220377844553323125319361429363n,
  },
  enc_c2: {
    x: 5354138489880603145660989882530344996482877820761323037615992423535320854067n,
    y: 5673357640632160246456676465503506305744881719544885834246246041367194670747n,
  },
  // 5 * G
  card5G: {
    x: 12229279139087521908560794489267966517139449915173592433539394009359081620359n,
    y: 12096995292699515952722386974733884667125946823386040531322131902193094989869n,
  },
  // 3 * G
  pk3: {
    x: 18660890509582237958343981571981920822503400000196279471655180441138020044621n,
    y: 8902249110305491597038405103722863701255802573786510474664632793109847672620n,
  },
  // APK = 3*G + 7*G = 10*G
  apk_3_7: {
    x: 3342385702510314143434845328821097103930566259175743498307413798692816291441n,
    y: 10065941468354809264390530807736843861492868337138424467566877250667942773429n,
  },
  // 4 * G
  card4G: {
    x: 763947558912359675602353050994051190166418588022888764656343140671310115434n,
    y: 1244893704640049169462398469384866579396698880516857177429128873187668729859n,
  },
};

// ──────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────

describe('Grumpkin curve', () => {
  test('generator point matches Noir', () => {
    const g = toPoint(G);
    expect(g.x).toBe(VECTORS.G.x);
    expect(g.y).toBe(VECTORS.G.y);
  });

  test('generator is on the curve: y² = x³ - 17', () => {
    const { x, y } = VECTORS.G;
    const lhs = (y * y) % GRUMPKIN_P;
    const rhs = ((x * x * x % GRUMPKIN_P) - 17n + GRUMPKIN_P) % GRUMPKIN_P;
    expect(lhs).toBe(rhs);
  });

  test('scalar multiplication: 42*G matches Noir', () => {
    const pk = toPoint(fixedBaseMul(42n));
    expect(pk.x).toBe(VECTORS.pk42.x);
    expect(pk.y).toBe(VECTORS.pk42.y);
  });

  test('scalar multiplication: 7*G matches Noir', () => {
    const pk = toPoint(fixedBaseMul(7n));
    expect(pk.x).toBe(VECTORS.pk7.x);
    expect(pk.y).toBe(VECTORS.pk7.y);
  });

  test('scalar multiplication: 3*G matches Noir', () => {
    const pk = toPoint(fixedBaseMul(3n));
    expect(pk.x).toBe(VECTORS.pk3.x);
    expect(pk.y).toBe(VECTORS.pk3.y);
  });

  test('point addition: 3*G + 7*G = 10*G matches Noir APK', () => {
    const p3 = fixedBaseMul(3n);
    const p7 = fixedBaseMul(7n);
    const sum = toPoint(p3.add(p7));
    expect(sum.x).toBe(VECTORS.apk_3_7.x);
    expect(sum.y).toBe(VECTORS.apk_3_7.y);
  });
});

describe('Key generation (privToPubKey)', () => {
  test('sk=42 matches Noir test_key_generation', () => {
    const pk = privToPubKey(42n);
    expect(pk.x).toBe(VECTORS.pk42.x);
    expect(pk.y).toBe(VECTORS.pk42.y);
  });

  test('sk=7 matches Noir', () => {
    const pk = privToPubKey(7n);
    expect(pk.x).toBe(VECTORS.pk7.x);
    expect(pk.y).toBe(VECTORS.pk7.y);
  });

  test('different keys give different pubkeys (Noir test_different_keys_different_pubkeys)', () => {
    const pk1 = privToPubKey(1n);
    const pk2 = privToPubKey(2n);
    expect(pk1.x).not.toBe(pk2.x);
  });
});

describe('ElGamal encrypt', () => {
  test('encrypt(pk7, card=5, r=13) matches Noir test_elgamal_encrypt_decrypt', () => {
    const pk = privToPubKey(7n);
    const encrypted = encrypt(pk, 5n, 13n);

    expect(encrypted.c1.x).toBe(VECTORS.enc_c1.x);
    expect(encrypted.c1.y).toBe(VECTORS.enc_c1.y);
    expect(encrypted.c2.x).toBe(VECTORS.enc_c2.x);
    expect(encrypted.c2.y).toBe(VECTORS.enc_c2.y);
  });
});

describe('ElGamal decrypt', () => {
  test('decrypt with single key matches Noir test_elgamal_encrypt_decrypt', () => {
    const sk = 7n;
    const pk = privToPubKey(sk);

    const encrypted = encrypt(pk, 5n, 13n);
    const token = computeRevealToken(sk, encrypted.c1);
    const decrypted = decryptWithTokens(encrypted.c2, [token]);

    expect(decrypted.x).toBe(VECTORS.card5G.x);
    expect(decrypted.y).toBe(VECTORS.card5G.y);
  });
});

describe('Remask', () => {
  test('remask preserves plaintext (Noir test_remask_preserves_plaintext)', () => {
    const sk = 11n;
    const pk = privToPubKey(sk);
    const cardScalar = 3n;

    const encrypted = encrypt(pk, cardScalar, 17n);
    const remasked = remask(encrypted, 23n, pk);

    // Decrypt remasked card
    const token = computeRevealToken(sk, remasked.c1);
    const decrypted = decryptWithTokens(remasked.c2, [token]);

    const expected = toPoint(fixedBaseMul(cardScalar));
    expect(decrypted.x).toBe(expected.x);
    expect(decrypted.y).toBe(expected.y);
  });
});

describe('Aggregate key decrypt', () => {
  test('two-player decrypt matches Noir test_aggregate_key_decrypt', () => {
    const sk1 = 5n;
    const sk2 = 9n;
    const pk1 = privToPubKey(sk1);
    const pk2 = privToPubKey(sk2);
    const apk = computeAggregateKey([pk1, pk2]);

    const encrypted = encrypt(apk, 7n, 19n);

    const token1 = computeRevealToken(sk1, encrypted.c1);
    const token2 = computeRevealToken(sk2, encrypted.c1);
    const decrypted = decryptWithTokens(encrypted.c2, [token1, token2]);

    const expected = toPoint(fixedBaseMul(7n));
    expect(decrypted.x).toBe(expected.x);
    expect(decrypted.y).toBe(expected.y);
  });
});

describe('Full shuffle protocol', () => {
  test('shuffle and remask preserves decryption (Noir test_shuffle_and_remask_preserves_decryption)', () => {
    const sk1 = 3n;
    const sk2 = 7n;
    const pk1 = privToPubKey(sk1);
    const pk2 = privToPubKey(sk2);
    const apk = computeAggregateKey([pk1, pk2]);

    // Verify APK matches Noir
    expect(apk.x).toBe(VECTORS.apk_3_7.x);
    expect(apk.y).toBe(VECTORS.apk_3_7.y);

    // Encrypt 4 cards (card_scalar = index + 1)
    const card0 = encrypt(apk, 1n, 100n);
    const card1 = encrypt(apk, 2n, 101n);
    const card2 = encrypt(apk, 3n, 102n);
    const card3 = encrypt(apk, 4n, 103n);

    // Player 1 shuffles: permutation [2,3,0,1] (swap 0<->2, 1<->3)
    const shuffled0 = remask(card2, 200n, apk);
    const shuffled1 = remask(card3, 201n, apk);
    const shuffled2 = remask(card0, 202n, apk);
    const shuffled3 = remask(card1, 203n, apk);

    // Player 2 shuffles: permutation [1,0,3,2] (swap 0<->1, 2<->3)
    const final0 = remask(shuffled1, 300n, apk);
    const _final1 = remask(shuffled0, 301n, apk);
    const _final2 = remask(shuffled3, 302n, apk);
    const _final3 = remask(shuffled2, 303n, apk);

    // After both shuffles, position 0 contains original card3 (scalar=4)
    const token1 = computeRevealToken(sk1, final0.c1);
    const token2 = computeRevealToken(sk2, final0.c1);
    const decrypted = decryptWithTokens(final0.c2, [token1, token2]);

    // Should be 4*G
    expect(decrypted.x).toBe(VECTORS.card4G.x);
    expect(decrypted.y).toBe(VECTORS.card4G.y);
  });
});

describe('Card table lookup', () => {
  test('builds correct table and looks up cards', () => {
    const table = buildCardTable(52);
    expect(table.size).toBe(52);

    // 1*G should map to card 0
    const p1 = toPoint(fixedBaseMul(1n));
    expect(lookupCard(p1, table)).toBe(0);

    // 5*G should map to card 4
    expect(lookupCard(VECTORS.card5G, table)).toBe(4);

    // 4*G should map to card 3
    expect(lookupCard(VECTORS.card4G, table)).toBe(3);
  });

  test('full encrypt-decrypt cycle with card lookup', () => {
    const sk = 42n;
    const pk = privToPubKey(sk);
    const table = buildCardTable(52);

    for (let i = 0; i < 52; i++) {
      const encrypted = encrypt(pk, BigInt(i + 1), BigInt(1000 + i));
      const token = computeRevealToken(sk, encrypted.c1);
      const decrypted = decryptWithTokens(encrypted.c2, [token]);
      expect(lookupCard(decrypted, table)).toBe(i);
    }
  });
});
