import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChannelFormPayload,
  normalizeHandle,
  type BuildChannelPayloadInput,
} from './channelFormPayload.ts';
import type { CreateChannelPayload, UpdateChannelPayload } from './api.ts';

describe('normalizeHandle', () => {
  it('should trim whitespace, prepend @ if missing, and convert to lowercase', () => {
    assert.equal(normalizeHandle('apextech'), '@apextech');
    assert.equal(normalizeHandle('@ApexTech'), '@apextech');
    assert.equal(normalizeHandle('  @ApexTech_99  '), '@apextech_99');
    assert.equal(normalizeHandle(''), '');
    assert.equal(normalizeHandle('   '), '');
  });
});

describe('buildChannelFormPayload', () => {
  const baseFormInput: Omit<BuildChannelPayloadInput, 'mode'> = {
    name: 'Apex Tech Reviews',
    handle: 'apextechreviews',
    youtubeUrl: 'https://youtube.com/@apextechreviews',
    niche: 'Technology & Gadgets',
    subscribersCount: '245000',
    monthlyViewsCount: '1200000',
    monetized: true,
    priceUsd: '14500.00',
    description: 'Tech hardware reviews and consumer guides.',
  };

  describe('Create Mode', () => {
    it('should construct a valid CreateChannelPayload with all fields populated', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'create',
      }) as CreateChannelPayload;

      assert.equal(payload.name, 'Apex Tech Reviews');
      assert.equal(payload.handle, '@apextechreviews');
      assert.equal(payload.youtubeUrl, 'https://youtube.com/@apextechreviews');
      assert.equal(payload.niche, 'Technology & Gadgets');
      assert.equal(payload.subscribersCount, 245000);
      assert.equal(payload.monthlyViewsCount, 1200000);
      assert.equal(payload.monetized, true);
      assert.equal(payload.priceUsd, 14500);
      assert.equal(payload.description, 'Tech hardware reviews and consumer guides.');
    });

    it('should retain create-mode behavior when optional fields are blank', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'create',
        youtubeUrl: '',
        monthlyViewsCount: '',
      }) as CreateChannelPayload;

      assert.equal(payload.youtubeUrl, undefined);
      assert.equal('monthlyViewsCount' in payload, false);
      assert.equal(payload.subscribersCount, 245000);
      assert.equal(payload.name, 'Apex Tech Reviews');
    });

    it('should handle whitespace-only optional fields in create mode as blank', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'create',
        youtubeUrl: '   ',
        monthlyViewsCount: '   ',
      }) as CreateChannelPayload;

      assert.equal(payload.youtubeUrl, undefined);
      assert.equal('monthlyViewsCount' in payload, false);
    });
  });

  describe('Edit Mode - Optional Field Clearing and Updating', () => {
    const existingListing = {
      id: '670c5e7b8f1a2b3c4d5e6f7a',
      name: 'Apex Tech Reviews',
      handle: '@apextechreviews',
      youtubeUrl: 'https://youtube.com/@apextechreviews',
      niche: 'Technology & Gadgets',
      subscribersCount: 245000,
      monthlyViewsCount: 1200000,
      monetized: true,
      priceCents: 1450000,
      description: 'Tech hardware reviews and consumer guides.',
    };

    it('should send explicit youtubeUrl: null when previously populated URL is cleared in edit mode', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: existingListing,
        youtubeUrl: '', // user cleared the input
      }) as UpdateChannelPayload;

      assert.equal(payload.youtubeUrl, null);
    });

    it('should send explicit youtubeUrl: null when previously populated URL is whitespace-cleared', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: existingListing,
        youtubeUrl: '   ',
      }) as UpdateChannelPayload;

      assert.equal(payload.youtubeUrl, null);
    });

    it('should send explicit monthlyViewsCount: null when previously populated count is cleared in edit mode', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: existingListing,
        monthlyViewsCount: '', // user cleared the input
      }) as UpdateChannelPayload;

      assert.equal(payload.monthlyViewsCount, null);
    });

    it('should send explicit monthlyViewsCount: null when previously 0 count is cleared in edit mode', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: {
          ...existingListing,
          monthlyViewsCount: 0,
        },
        monthlyViewsCount: '', // user cleared 0
      }) as UpdateChannelPayload;

      assert.equal(payload.monthlyViewsCount, null);
    });

    it('should omit youtubeUrl when not previously populated and remains blank in edit mode', () => {
      const payloadNullInitial = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: {
          ...existingListing,
          youtubeUrl: null,
        },
        youtubeUrl: '',
      }) as UpdateChannelPayload;

      assert.equal('youtubeUrl' in payloadNullInitial, false);

      const payloadUndefinedInitial = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: {
          ...existingListing,
          youtubeUrl: undefined,
        },
        youtubeUrl: '',
      }) as UpdateChannelPayload;

      assert.equal('youtubeUrl' in payloadUndefinedInitial, false);
    });

    it('should omit monthlyViewsCount when not previously populated and remains blank in edit mode', () => {
      const payloadNullInitial = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: {
          ...existingListing,
          monthlyViewsCount: null,
        },
        monthlyViewsCount: '',
      }) as UpdateChannelPayload;

      assert.equal('monthlyViewsCount' in payloadNullInitial, false);

      const payloadUndefinedInitial = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: {
          ...existingListing,
          monthlyViewsCount: undefined,
        },
        monthlyViewsCount: '',
      }) as UpdateChannelPayload;

      assert.equal('monthlyViewsCount' in payloadUndefinedInitial, false);
    });

    it('should send updated URL and count when valid replacement values are provided', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: existingListing,
        youtubeUrl: 'https://youtube.com/@newchannel',
        monthlyViewsCount: '500000',
      }) as UpdateChannelPayload;

      assert.equal(payload.youtubeUrl, 'https://youtube.com/@newchannel');
      assert.equal(payload.monthlyViewsCount, 500000);
    });

    it('should preserve existing values when not cleared or changed in edit mode', () => {
      const payload = buildChannelFormPayload({
        ...baseFormInput,
        mode: 'edit',
        initialData: existingListing,
        youtubeUrl: 'https://youtube.com/@apextechreviews',
        monthlyViewsCount: '1200000',
      }) as UpdateChannelPayload;

      assert.equal(payload.youtubeUrl, 'https://youtube.com/@apextechreviews');
      assert.equal(payload.monthlyViewsCount, 1200000);
    });
  });
});
