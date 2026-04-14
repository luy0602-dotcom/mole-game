export default function Hammer({ hands }) {
  return hands
    .filter((hand) => hand.detected && (hand.fist || hand.hit))
    .map((hand) => (
    <div
      key={hand.id}
      className={`hammer hammer-${hand.id} visible ${hand.hit ? "swing" : ""}`}
      style={{
        transform: `translate(${hand.x * window.innerWidth - 54}px, ${hand.y * window.innerHeight - 92}px) rotate(${hand.hit ? (hand.id === "left" ? "-26deg" : "26deg") : hand.id === "left" ? "-8deg" : "8deg"})`,
      }}
    >
      <div className="hammer-head" />
      <div classNam