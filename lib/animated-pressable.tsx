import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

type Props = Omit<PressableProps, "style"> & {
  style?:
    | StyleProp<ViewStyle>
    | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  scaleTo?: number;
};

export function AnimatedPressable({
  style,
  scaleTo = 0.972,
  disabled,
  ...props
}: Props) {
  return (
    <Pressable
      {...props}
      disabled={disabled}
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        {
          transform: [{ scale: state.pressed ? scaleTo : 1 }],
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    />
  );
}
