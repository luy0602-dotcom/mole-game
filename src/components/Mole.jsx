export default function Mole({ mole, setRef, layout }) {
  return (
    <article
      className={`hole-card state-${mole.state} variant-${mole.variant}`}
      ref={setRef}
      data-drum={mole.id}
      style={{
        "--impact-shift": `${mole.impact * 10 - 5}px`,
        "--field-x": layout?.x,
        "--field-y": layout?.y,
        "--field-scale": layout?.size,
        "--field-z": layout?.z,
      }}
    >
      <div className="hole-base-shadow" />
      <div className="hole-ring">
        <div className="hole-ring-top" />
        <div className="hole-ring-inner" />
      </div>
      <div className="hole-rim">
        <div className="mole-spring">
          <div className={`instrument-badge instrument-${mole.id}`}>
            <span className="instrument-art" />
          </div>
          <div className="mole-body">
            <div className="mole-top-planes">
              <span className="top-plane plane-left" />
              <span className="top-plane plane-center" />
              <span className="top-plane plane-right" />
            </div>
            <div className="mole-facet facet-a" />
            <div className="mole-facet facet-b" />
            <div className="mole-facet facet-c" />
            <div className="mole-facet facet-d" />
            <div className="mole-forehead" />
            <div className="mole-side side-left" />
            <div className="mole-side side-right" />
            <div className="mole-snout">
              <div className="mole-nose" />
            </div>
            <div className="mole-cheek cheek-left" />
            <div className="mole-cheek cheek-right" />
            <div className="mole-hit-blush blush-hit-left" />
            <div className="mole-hit-blush blush-hit-right" />
            <div className="mole-face">
              <span />
              <span />
              <i className="whisker whisker-left" />
              <i className="whisker whisker-right" />
            </div>
            <div className="mole-sad-mouth" />
            <div className="mole-bandage">
              <span className="bandage-strip strip-a" />
              <span className="bandage-strip strip-b" />
            </div>
            <div className="mole-accessory accessory-band" />
            <div className="mole-accessory accessory-crown" />
            <div className="mole-accessory accessory-pickaxe">
              <span className="pickaxe-head" />
              <span className="pickaxe-stick" />
            </div>
            <div className="mole-accessory accessory-teeth" />
            <div className="mole-accessory accessory-glasses">
              <span className="glass glass-left" />
              <span className="glass glass-right" />
              <span className="glass-bridge" />
            </div>
            <div className="mole-accessory accessory-camera">
              <span className="camera-body" />
              <span className="camera-lens" />
            </div>
            <div className="mole-paws">
              <b />
              <b />
            </div>
          </div>
          <div className="impact-ring" />
        </div>
        <div className="mole-nameplate">{mole.label}</div>
      </div>
    </article>
  );
}
