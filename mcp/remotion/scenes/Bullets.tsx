import React from "react";
import { fitSize, rgba, useEnter, type Box, type SceneData, type VideoProps } from "../theme";

/** Used for both "bullets" (dots) and "steps" (numbered circles). */
export const Bullets: React.FC<{ s: SceneData; p: VideoProps; box: Box; numbered: boolean }> = ({ s, p, box, numbered }) => {
  const { motion } = p;
  const items = s.items ?? [];
  const head = s.heading ?? "";
  const headSize = head ? fitSize(head, box.cw, box.ch * 0.2, 84, 36, 1.1) : 0;
  const rowH = (box.ch - (head ? headSize * 1.1 + 48 : 0)) / Math.max(items.length, 1);
  const maxItem = items.length === 1 ? (box.vertical ? 88 : 76) : box.vertical ? 80 : 68;
  const cap = box.vertical ? 300 : 170;
  const itemSize = Math.min(...items.map((t) => fitSize(t, box.cw - 120, Math.min(rowH - 24, cap), maxItem, 26, 1.15)), maxItem);
  const h = useEnter(2, motion.damping);
  return (
    <div>
      {head ? (
        <div style={{ fontSize: headSize, fontWeight: 800, lineHeight: 1.1, marginBottom: 40, opacity: h, transform: `translateY(${(1 - h) * motion.travel * 0.6}px)` }}>
          {head}
        </div>
      ) : null}
      {items.map((t, i) => (
        <Row key={i} i={i} text={t} size={itemSize} numbered={numbered} p={p} />
      ))}
    </div>
  );
};

const Row: React.FC<{ i: number; text: string; size: number; numbered: boolean; p: VideoProps }> = ({ i, text, size, numbered, p }) => {
  const { theme, motion } = p;
  const e = useEnter(10 + Math.round(i * motion.stagger * 30), motion.damping);
  const dot = Math.round(size * 1.05);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, marginBottom: 26, opacity: e, transform: `translateX(${(1 - e) * -motion.travel}px)` }}>
      {numbered ? (
        <div style={{ width: dot, height: dot, flex: "none", borderRadius: "50%", background: theme.accent, color: "#fff", fontWeight: 800, fontSize: size * 0.7, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {i + 1}
        </div>
      ) : (
        <div style={{ width: size * 0.38, height: size * 0.38, flex: "none", borderRadius: "50%", background: theme.accent, boxShadow: `0 0 0 8px ${rgba(theme.accent, 0.2)}`, margin: `0 ${size * 0.2}px` }} />
      )}
      <div style={{ fontSize: size, lineHeight: 1.15, fontWeight: 600, overflowWrap: "break-word", minWidth: 0 }}>{text}</div>
    </div>
  );
};
