import React from "react";
import { Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import { SceneFrame, contentBox } from "./Scene";
import { Bullets } from "./scenes/Bullets";
import { Chart } from "./scenes/Chart";
import { Compare } from "./scenes/Compare";
import { End } from "./scenes/End";
import { ImageScene } from "./scenes/Image";
import { Quote } from "./scenes/Quote";
import { Stat } from "./scenes/Stat";
import { Title } from "./scenes/Title";
import type { SceneData, VideoProps } from "./theme";

const Body: React.FC<{ s: SceneData; p: VideoProps }> = ({ s, p }) => {
  const box = contentBox(p);
  switch (s.kind) {
    case "title": return <Title s={s} p={p} box={box} />;
    case "bullets": return <Bullets s={s} p={p} box={box} numbered={false} />;
    case "steps": return <Bullets s={s} p={p} box={box} numbered />;
    case "stat": return <Stat s={s} p={p} box={box} />;
    case "quote": return <Quote s={s} p={p} box={box} />;
    case "compare": return <Compare s={s} p={p} box={box} />;
    case "chart": return <Chart s={s} p={p} box={box} />;
    case "image": return <ImageScene s={s} p={p} box={box} />;
    default: return <End s={s} p={p} box={box} />;
  }
};

export const McpVideo: React.FC<VideoProps> = (props) => {
  const { durationInFrames, fps } = useVideoConfig();
  let from = 0;
  const box = contentBox(props);
  return (
    <>
      {props.scenes.map((s) => {
        const seq = (
          <Sequence key={s.id} from={from} durationInFrames={s.durationFrames}>
            <SceneFrame scene={s} props={props} box={box}>
              <Body s={s} p={props} />
            </SceneFrame>
          </Sequence>
        );
        from += s.durationFrames;
        return seq;
      })}
      {props.music ? (
        <Audio
          src={staticFile(props.music.src)}
          loop
          volume={(f) =>
            props.music!.volume *
            interpolate(f, [0, fps, durationInFrames - 2 * fps, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          }
        />
      ) : null}
    </>
  );
};
