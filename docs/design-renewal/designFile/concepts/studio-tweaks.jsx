/* global React, useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakColor */
// Studio Tweaks — live controls for identity, accent, surface tone, density.
// State is held in the wrapper; on change we mutate window.studioTokens
// (which all studio screens read inline) and force a re-render of the canvas
// via a key bump. Identity is read at every render via window.__studioIdentity.

const STUDIO_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "identity": "logo",
  "accent": "#c4853a",
  "surface": "warm",
  "density": "regular"
}/*EDITMODE-END*/;

// Accent presets keyed by hex (the value TweakColor stores).
const STUDIO_ACCENT_PRESETS = {
  '#c4853a': { accent: 'oklch(0.62 0.14 55)',  accentBg: 'oklch(0.94 0.04 65)'  }, // ochre
  '#3658d4': { accent: 'oklch(0.55 0.18 258)', accentBg: 'oklch(0.93 0.04 258)' }, // cobalt
  '#2a8e64': { accent: 'oklch(0.55 0.13 155)', accentBg: 'oklch(0.93 0.05 155)' }, // emerald
  '#9e3da8': { accent: 'oklch(0.50 0.16 320)', accentBg: 'oklch(0.93 0.05 320)' }, // plum
};
const STUDIO_ACCENT_OPTIONS = Object.keys(STUDIO_ACCENT_PRESETS);

const STUDIO_SURFACE_PRESETS = {
  warm: {  // default — bone / oat
    bg:       'oklch(0.975 0.008 75)',
    card2:    'oklch(0.985 0.006 75)',
    border:   'oklch(0.92 0.008 75)',
    borderHi: 'oklch(0.85 0.01 75)',
  },
  cool: {  // cool gray — desaturated
    bg:       'oklch(0.975 0.003 240)',
    card2:    'oklch(0.985 0.002 240)',
    border:   'oklch(0.92 0.004 240)',
    borderHi: 'oklch(0.85 0.005 240)',
  },
};

// Density multipliers — applied as a CSS variable read by `.studio-densitize`
// targets (currently none; reserved for future). For now we only inject the
// variable on the wrapper so it's available to inline styles via `var(...)`.
const STUDIO_DENSITY_SCALE = { compact: 0.86, regular: 1, comfy: 1.15 };

// Apply tweaks to studioTokens. Returns the patched tokens snapshot so the
// caller can show a brief flash / confirm.
function applyStudioTweaks(t) {
  const tokens = window.studioTokens;
  if (!tokens) return;
  // Identity is read at render time, not via tokens.
  window.__studioIdentity = t.identity;
  // Accent — looked up by hex key
  const a = STUDIO_ACCENT_PRESETS[t.accent] || STUDIO_ACCENT_PRESETS['#c4853a'];
  tokens.accent   = a.accent;
  tokens.accentBg = a.accentBg;
  // Surface
  const s = STUDIO_SURFACE_PRESETS[t.surface] || STUDIO_SURFACE_PRESETS.warm;
  tokens.bg       = s.bg;
  tokens.card2    = s.card2;
  tokens.border   = s.border;
  tokens.borderHi = s.borderHi;
}

function StudioTweaksWrapper({ children }) {
  const [t, setTweak] = useTweaks(STUDIO_TWEAK_DEFAULTS);

  // Apply on first render and every change — before the canvas's first paint
  // when possible so users don't see a flicker.
  applyStudioTweaks(t);

  // `bump` triggers DesignCanvas remount when tokens change. Without this the
  // already-rendered artboards keep their old colors (inline styles captured
  // the previous token values).
  const bump = `${t.identity}-${t.accent}-${t.surface}-${t.density}`;

  return (
    <>
      <TweaksPanel title="Studio · Tweaks" noDeckControls>
        <TweakSection label="마켓 아이덴티티 표현" />
        <TweakRadio
          label="표시 방식"
          value={t.identity}
          options={[
            { value: 'logo', label: '이니셜' },
            { value: 'bar',  label: '컬러바' },
            { value: 'dot',  label: '도트' },
          ]}
          onChange={(v) => setTweak('identity', v)}
        />

        <TweakSection label="브랜드 컬러" />
        <TweakColor
          label="액센트"
          value={t.accent}
          options={STUDIO_ACCENT_OPTIONS}
          onChange={(v) => setTweak('accent', v)}
        />

        <TweakSection label="표면" />
        <TweakRadio
          label="배경 톤"
          value={t.surface}
          options={[
            { value: 'warm', label: '웜 베이지' },
            { value: 'cool', label: '쿨 그레이' },
          ]}
          onChange={(v) => setTweak('surface', v)}
        />

        <TweakSection label="밀도" />
        <TweakRadio
          label="간격"
          value={t.density}
          options={[
            { value: 'compact', label: '컴팩트' },
            { value: 'regular', label: '표준' },
            { value: 'comfy',   label: '여유' },
          ]}
          onChange={(v) => setTweak('density', v)}
        />
      </TweaksPanel>

      <div key={bump} style={{
        height: '100%',
        // density CSS var — reserved for future use
        '--mc-density': STUDIO_DENSITY_SCALE[t.density],
      }}>
        {children}
      </div>
    </>
  );
}

// TweakColor takes bare hex strings (or arrays). We use hex as the canonical
// accent key and look up oklch tokens via STUDIO_ACCENT_PRESETS at apply time.
// This keeps the on-disk EDITMODE block readable + the swatch UI matches the
// real value the user picks.

Object.assign(window, {
  StudioTweaksWrapper, STUDIO_TWEAK_DEFAULTS,
  STUDIO_ACCENT_PRESETS, STUDIO_SURFACE_PRESETS,
  applyStudioTweaks,
});
