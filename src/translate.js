import { TRANSLATE_PROVIDER, DEEPL_API_KEY } from './config.js';

/**
 * Translate text to Japanese for VOICEVOX synthesis.
 * Returns the original text unchanged if no provider is configured or on error.
 */
export async function toJapanese(text) {
  if (!TRANSLATE_PROVIDER || !text) return text;

  try {
    if (TRANSLATE_PROVIDER === 'mymemory') {
      const res  = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ja`
      );
      const data = await res.json();
      return data.responseData?.translatedText ?? text;
    }

    if (TRANSLATE_PROVIDER === 'deepl') {
      const res  = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        },
        body: JSON.stringify({ text: [text], target_lang: 'JA' }),
      });
      const data = await res.json();
      return data.translations?.[0]?.text ?? text;
    }
  } catch (err) {
    console.warn('[translate]', err.message);
  }

  return text;
}
