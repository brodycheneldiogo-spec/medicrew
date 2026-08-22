import Svg, { Circle, Path, Rect } from "react-native-svg";

export function MissionIllustration({
  kind,
  size = 118,
}: {
  kind: "transport" | "event";
  size?: number;
}) {
  if (kind === "event") {
    return (
      <Svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        accessibilityLabel="Event medical staffing illustration"
      >
        <Circle cx="60" cy="60" r="57" fill="#F4E9FF" />
        <Path
          d="M19 77c13-18 25-27 41-27s30 8 42 27"
          fill="#6D4BD1"
          opacity=".18"
        />
        <Path d="M27 76h66v17H27z" fill="#5636B5" />
        <Path
          d="M35 76V48m50 28V48"
          stroke="#321D78"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path d="M28 49c9-15 19-22 32-22s24 7 33 22" fill="#FFB45B" />
        <Circle cx="60" cy="55" r="14" fill="#FFF" />
        <Path
          d="M60 47v16m-8-8h16"
          stroke="#E55A72"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Circle cx="27" cy="29" r="4" fill="#FFB45B" />
        <Circle cx="94" cy="35" r="5" fill="#E55A72" />
      </Svg>
    );
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      accessibilityLabel="Air medical transport illustration"
    >
      <Circle cx="60" cy="60" r="57" fill="#DDF4F2" />
      <Path
        d="M12 74c17-7 34-10 51-9 16 1 31 6 45 14"
        fill="none"
        stroke="#87D3CC"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <Path
        d="m20 59 75-23c5-2 9 5 5 8L68 65l-15 27-8 2 5-29-20 6z"
        fill="#147C74"
      />
      <Path d="m51 54 10-25 9-3-3 23" fill="#0B5651" />
      <Circle cx="91" cy="31" r="13" fill="#FFF" />
      <Path
        d="M91 24v14m-7-7h14"
        stroke="#E15262"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </Svg>
  );
}
