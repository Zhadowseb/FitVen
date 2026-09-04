import {View, StyleSheet, useColorScheme} from "react-native"
import { Colors } from "../GlobalStyling/colors"
import { Radius } from "../GlobalStyling/spacing"

// Surface only. The base style used to bake in marginVertical 10,
// marginHorizontal 10 and padding 10, which every single call site then reset,
// so a card could not be placed without undoing the component first.
//
// styles.card comes before the theme colours so a value added here can never
// override the theme, matching ThemedView.
const ThemedCard = ( {style, ...props} ) => {

    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <View 
            style={
                [styles.card,
                    {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.cardBorder,
                    },
                    style]
            }
            {...props}
        />
    )

}

export default ThemedCard

const styles = StyleSheet.create({

    card: {
        borderRadius: Radius.xl,
        borderWidth: 1,
    }
})
