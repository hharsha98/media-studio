import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { CalculateMetadataFunction } from "remotion";
import { Audio } from "@remotion/media";

/**
 * A data-driven teaser. You (or Claude) edit the JSON props, not the code:
 * each scene is one cut. Make the cuts land on the beat by choosing
 * `seconds` so the scene boundaries sit on strong beats of the music.
 */
export type TeaserScene = {
  /** Big line. Use \n for a second line. Only text the viewer must read. */
  text: string;
  /** Small line under it. */
  sub?: string;
  /** How long the scene stays on screen. A cut happens when it ends. */
  seconds: number;
  /** Background colour, any CSS colour. */
  bg: string;
  /** Text colour. */
  fg?: string;
  /** Accent colour (the rule under the title and the sub line). */
  accent?: string;
  /** Optional REAL screenshot, a path inside public/ (for example "runs/x/shot.png"). */
  image?: string;
};

export type TeaserSfx = { file: string; atSec: number; volume?: number };

export type TeaserProps = {
  scenes: TeaserScene[];
  /** Path inside public/, for example "music/track.mp3". */
  music?: string;
  /** Where in the track to start (seconds). Pick a start that lands a strong beat on your first cut. */
  musicStartSec?: number;
  /** 0 to 1. A music-only teaser can sit near 0.85 (master it to -14 LUFS afterwards); under a voice use about 0.15. */
  musicVolume?: number;
  sfx?: TeaserSfx[];
  /** Small line shown on the last scene, for example the music credit. */
  credits?: string;
  fontFamily?: string;
};

export const FPS = 30;

export const teaserDefaults: TeaserProps = {
  scenes: [
    { text: "Make media\nwith Claude Code.", seconds: 2.2, bg: "#0b1020", fg: "#f5f7ff", accent: "#6ea8ff" },
    { text: "Teasers.\nCards.\nCarousels.", sub: "Real footage in, honest media out.", seconds: 2.0, bg: "#f4efe6", fg: "#16130f", accent: "#d9480f" },
    { text: "media-studio", sub: "A Claude Code plugin", seconds: 2.0, bg: "#0b1020", fg: "#f5f7ff", accent: "#6ea8ff" },
  ],
  musicVolume: 0.85,
};

export const calculateTeaserMetadata: CalculateMetadataFunction<TeaserProps> = ({ props }) => {
  const total = props.scenes.reduce((sum, s) => sum + s.seconds, 0);
  return { durationInFrames: Math.max(1, Math.round(total * FPS)) };
};

const SceneView: React.FC<{ scene: TeaserScene; index: number; isLast: boolean; credits?: string; font: string }> = ({ scene, index, isLast, credits, font }) => {
  const f = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const lines = scene.text.split("\n");
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const base = Math.min(width * 0.1, (width * 0.84) / (longest * 0.55));
  const size = Math.max(width * 0.05, base);
  const fg = scene.fg ?? "#ffffff";
  const accent = scene.accent ?? fg;
  const pad = width * 0.08;
  const hasImage = Boolean(scene.image);

  const barW = interpolate(spring({ frame: f - 2, fps, config: { damping: 200 } }), [0, 1], [0, width * 0.14]);
  const subIn = spring({ frame: f - 6 - lines.length * 4, fps, config: { damping: 200 } });
  const flash = index === 0 ? 0 : interpolate(f, [0, 6], [0.3, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: scene.bg, fontFamily: font, color: fg }}>
      <div
        style={{
          position: "absolute",
          left: pad,
          right: pad,
          top: hasImage ? pad : 0,
          bottom: hasImage ? undefined : 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: hasImage ? "flex-start" : "center",
          gap: size * 0.28,
        }}
      >
        <div style={{ height: Math.max(4, size * 0.07), width: barW, background: accent, borderRadius: 4 }} />
        <div>
          {lines.map((line, i) => {
            const p = spring({ frame: f - i * 4, fps, config: { damping: 200 } });
            return (
              <div
                key={i}
                style={{
                  fontSize: size,
                  fontWeight: 800,
                  lineHeight: 1.04,
                  letterSpacing: "-0.02em",
                  opacity: p,
                  transform: `translateY(${(1 - p) * size * 0.4}px)`,
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
        {scene.sub ? (
          <div
            style={{
              fontSize: Math.max(width * 0.032, size * 0.34),
              fontWeight: 500,
              color: accent,
              opacity: subIn,
              transform: `translateY(${(1 - subIn) * 14}px)`,
            }}
          >
            {scene.sub}
          </div>
        ) : null}
      </div>

      {hasImage ? (
        <div
          style={{
            position: "absolute",
            left: pad,
            right: pad,
            bottom: pad,
            height: height * 0.5,
            borderRadius: width * 0.016,
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.35)",
            border: `2px solid ${accent}55`,
            opacity: interpolate(f, [8, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          <Img src={staticFile(scene.image as string)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
        </div>
      ) : null}

      {isLast && credits ? (
        <div style={{ position: "absolute", left: pad, right: pad, bottom: pad * 0.55, fontSize: width * 0.024, opacity: 0.8 }}>{credits}</div>
      ) : null}

      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash, pointerEvents: "none" }} />
    </AbsoluteFill>
  );
};

export const Teaser: React.FC<TeaserProps> = ({ scenes, music, musicStartSec = 0, musicVolume = 0.85, sfx = [], credits, fontFamily }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const font = fontFamily ?? "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  let cursor = 0;
  const fadeIn = Math.round(0.15 * fps);
  const fadeOut = Math.round(0.9 * fps);

  return (
    <AbsoluteFill style={{ backgroundColor: scenes[0]?.bg ?? "#000" }}>
      {scenes.map((scene, i) => {
        const from = cursor;
        const dur = Math.max(1, Math.round(scene.seconds * fps));
        cursor += dur;
        return (
          <Sequence key={i} from={from} durationInFrames={dur} premountFor={fps}>
            <SceneView scene={scene} index={i} isLast={i === scenes.length - 1} credits={credits} font={font} />
          </Sequence>
        );
      })}

      {music ? (
        <Audio
          src={staticFile(music)}
          trimBefore={Math.round(musicStartSec * fps)}
          volume={(frame) =>
            musicVolume *
            interpolate(frame, [0, fadeIn, durationInFrames - fadeOut, durationInFrames], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}

      {sfx.map((s, i) => (
        <Sequence key={`sfx-${i}`} from={Math.round(s.atSec * fps)} layout="none">
          <Audio src={staticFile(s.file)} volume={s.volume ?? 0.7} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
