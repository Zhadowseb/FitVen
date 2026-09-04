import {Text, useColorScheme} from "react-native"
import { Colors } from "../GlobalStyling/colors"
import { Typography } from "../GlobalStyling/typography"

// `type` names a step on the Typography scale, the way ThemedTitle already
// does. `size` stays as the escape hatch for a one-off value.
//
// Deliberately not retrofitted: the app writes some 600 fontSize numbers
// directly, and swapping them wholesale would resize text on every screen
// with no way to check the result. Use `type` in new code and in files
// another change is touching anyway.
const ThemedText = ( {type, size, setColor, style, ...props} ) => {

    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <Text 
            style={
                [type ? Typography[type] : null,
                    { color: setColor ? setColor : theme.text },
                    // Only when given: RN's style flattening copies undefined
                    // over, which would wipe out the type's own font size.
                    size === undefined ? null : { fontSize: size },
                    style]
            }
            {...props}
        />
    )

}

export default ThemedText
