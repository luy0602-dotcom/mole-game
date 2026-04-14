import Mole from "./Mole";

const FIELD_LAYOUT = [
  { id: "crash", x: "17%", y: "24%", size: "1.06", z: 2 },
  { id: "hihat", x: "36%", y: "18%", size: "1.02", z: 3 },
  { id: "cymbal", x: "57%", y: "22%", size: "1.05", z: 2 },
  { id: "midTom", x: "80%", y: "27%", size: "1.02", z: 1 },
  { id: "ride", x: "20%", y: "54%", size: "1.08", z: 2 },
  { id: "floorTom", x: "41%", y: "46%", size: "1.12", z: 4 },
  { id: "snare", x: "63%", y: "54%", size: "1.05", z: 3 },
  { id: "bass", x: "84%", y: "45%", size: "1.13", z: 2 },
];

export default function MoleGrid({ moles, moleRefs }) {
  return (
    <div className="mole-field">
      <div className="field-prop prop-tree tree-a" />
      <div className="field-prop prop-tree tree-b" />
      <div className="field-prop prop-tree tree-c" />
      <div className="field-prop prop-tree tree-d" />
      <div className="field-prop prop-tree tree-e" />
      <div className="field-prop prop-rock rock-a" />
      <div className="field-prop prop-rock rock-b" />
      <div className="field-prop prop-rock rock-c" />
      <div className="field-prop prop-rock rock-d" />
      <div className="field-prop prop-rock rock-e" />
      <div className="field-prop prop-rock rock-f" />
      <div className="field-prop field-grass grass-a" />
      <div className="field-prop field-grass grass-b" />
      <div className="field-prop field-grass grass-c" />
      <div className="field-prop field-grass grass-d" />
      <div className="field-prop field-grass grass-e" />
      <div className="field-glow glow-a" />
      <div className="field-glow glow-b" />
      {moles.map((mole) => {
        const layout = FIELD_LAYOUT.find((item) => item.id === mole.id);

        return (
          <Mole
            key={mole.id}
            mole={mole}
            layout={layout}
            setRef={(node) => {
              moleRefs.current[mole.id] = node;
            }}
          />
        );
      })}
    </div>
  );
}
