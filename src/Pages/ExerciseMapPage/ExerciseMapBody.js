import { memo, useId, useMemo } from 'react';
import { Image, View, useColorScheme } from 'react-native';
import Svg, { Defs, G, Path, Pattern, RadialGradient, Stop } from 'react-native-svg';
import { Colors } from '@resources/GlobalStyling/colors';
import { ThemedText } from '@resources/ThemedComponents';
import bodyData from './bodyData.json';
import { REGION_LABELS } from './exerciseMapUtils';
import styles from './ExerciseMapPageStyle';
import { createMuscleTouchHandlers } from './exerciseMapTouch';

const images = {
  front: require('@resources/BodyMap/Front/Front_body_compressed.png'),
  back: require('@resources/BodyMap/Back/Back_body_compressed.png'),
};

// `onSelect` absent means the figure is decoration - a thumbnail beside an
// exercise - so it grows no touch handlers, claims no accessibility role and
// lets taps through to whatever it sits inside. `showLabel` is off there too:
// a FRONT/BACK caption belongs over a figure you are meant to read, not over a
// 48-pixel picture in a list row.
function ExerciseMapBody({ side, width, crop, surface, primary, secondary, selected, mode, onSelect, showLabel = true }) {
  const scheme = useColorScheme();
  const theme = Colors[scheme] ?? Colors.light;
  const data = bodyData[side];
  const interactive = typeof onSelect === 'function';
  const muscleTouches = useMemo(() => interactive
    ? Object.fromEntries(Object.keys(data.regions).map(key => [key, createMuscleTouchHandlers(() => onSelect(key))]))
    : null, [data, onSelect, interactive]);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '') + side;
  const y = crop === 'upper' ? 125 : crop === 'lower' ? 570 : 0;
  const viewHeight = crop === 'upper' ? 535 : data.height - y;
  const modelWidth = Math.min(width, 440 * data.width / viewHeight);
  const scale = modelWidth / data.width;
  const height = viewHeight * scale;
  const neutral = scheme === 'dark' ? ['#A7ADB9', '#6C7484', '#363E4F', '#252C3A'] : ['#AEB3BF', '#8B93A4', '#697386', '#4E596C'];
  return <View style={styles.figure}>
    {showLabel ? <ThemedText style={styles.figureLabel} setColor={theme.quietText}>{side === 'front' ? 'FRONT' : 'BACK'}</ThemedText> : null}
    <View pointerEvents={interactive ? 'auto' : 'none'} style={[styles.bodyFrame, { width: modelWidth, height }]}>
      <Image pointerEvents="none" source={images[side]} resizeMode="stretch" accessible={false} style={{ position: 'absolute', top: -y * scale, left: 0, width: modelWidth, height: data.height * scale, tintColor: theme.quietText, opacity: 0.3 }} />
      <Svg width={modelWidth} height={height} viewBox={`0 ${y} ${data.width} ${viewHeight}`}>
        <Defs>
          <RadialGradient id={`${id}neutral`} cx="36%" cy="30%" r="80%">
            <Stop offset={0} stopColor={neutral[0]} /><Stop offset={0.36} stopColor={neutral[1]} /><Stop offset={0.8} stopColor={neutral[2]} /><Stop offset={1} stopColor={neutral[3]} />
          </RadialGradient>
          <RadialGradient id={`${id}primary`} cx="35%" cy="25%" r="85%">
            <Stop offset={0} stopColor="#BBF2DC" /><Stop offset={0.4} stopColor="#60DAAC" /><Stop offset={0.8} stopColor="#28AD7C" /><Stop offset={1} stopColor="#147451" />
          </RadialGradient>
          <RadialGradient id={`${id}secondary`} cx="35%" cy="25%" r="85%">
            <Stop offset={0} stopColor="#60B599" /><Stop offset={0.45} stopColor="#18A06C" /><Stop offset={1} stopColor="#12523E" />
          </RadialGradient>
          <Pattern id={`${id}stripes`} width="13" height="13" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
            <Path d="M0 0L0 13" stroke="#BBF2DC" strokeWidth={2} opacity={0.3} />
          </Pattern>
        </Defs>
        {Object.entries(data.regions).map(([key, paths]) => {
          const role = mode === 'muscles' ? selected.includes(key) ? 'primary' : 'neutral' : primary.includes(key) ? 'primary' : secondary.includes(key) ? 'secondary' : 'neutral';
          return <G key={key} {...(interactive ? muscleTouches[key] : null)} accessible={interactive} accessibilityRole={interactive ? 'button' : undefined} accessibilityLabel={interactive ? `${REGION_LABELS[key]}, ${mode === 'muscles' ? selected.includes(key) ? 'selected' : 'select muscle' : role}` : undefined}>
            {paths.map(path => <G key={path.id}>
              <Path d={path.d} fill={surface === 'contour' ? role === 'primary' ? '#60DAAC' : role === 'secondary' ? '#18A06C' : neutral[1] : `url(#${id}${role})`} fillOpacity={surface === 'contour' ? 0.6 : 1} stroke={role === 'neutral' ? neutral[0] : '#B7F2DC'} strokeWidth={1.8} strokeOpacity={role === 'neutral' ? 0.5 : 0.85} />
              {role === 'secondary' ? <Path d={path.d} fill={`url(#${id}stripes)`} pointerEvents="none" /> : null}
            </G>)}
          </G>;
        })}
      </Svg>
    </View>
  </View>;
}
export default memo(ExerciseMapBody);
