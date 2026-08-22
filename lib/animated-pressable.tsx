import { useRef } from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

const MotionPressable = Animated.createAnimatedComponent(Pressable);

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
  const scale = useRef(new Animated.Value(1)).current;
  const move = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      speed: 34,
      bounciness: 3,
    }).start();

  return (
    <MotionPressable
      {...props}
      disabled={disabled}
      onPressIn={(event) => {
        move(scaleTo);
        props.onPressIn?.(event);
      }}
      onPressOut={(event) => {
        move(1);
        props.onPressOut?.(event);
      }}
      style={(state) => [
        typeof style === "function" ? style(state) : style,
        { transform: [{ scale }], opacity: disabled ? 0.55 : 1 },
      ]}
    />
  );
}
