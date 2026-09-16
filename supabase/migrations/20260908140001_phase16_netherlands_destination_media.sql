-- Phase 16 corrective migration: governed media for the live Netherlands opportunity set.
-- The asset is stored locally; this row records its source and licence metadata.

insert into public.destination_media
  (country_code, city_name, asset_path, provider, original_source_url, photographer, licence, attribution, alt_text, width, height, priority)
values
  (
    'NL',
    'Amsterdam',
    '/images/destinations/amsterdam-skyline.jpg',
    'Wikimedia Commons',
    'https://commons.wikimedia.org/wiki/File:Amsterdam_Skyline_View.jpg',
    'pxhere photo',
    'CC0',
    'pxhere photo / Wikimedia Commons / CC0',
    'Amsterdam cityscape in the Netherlands',
    1280,
    960,
    10
  );
