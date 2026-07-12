import {View, StyleSheet, useColorScheme} from "react-native"
import { Colors } from "../GlobalStyling/colors"

const ThemedCard = ( {style, ...props} ) => {

    const colorScheme = useColorScheme()
    const theme = Colors[colorScheme] ?? Colors.light

    return (
        <View 
            style={
                [{
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.cardBorder,
                },
                    styles.card,
                    style]
            }
            {...props}
        />
    )

}

export default ThemedCard

const styles = StyleSheet.create({
    
    card: {
        marginVertical: 10,
        marginHorizontal: 10,
        borderRadius: 20,
        borderWidth: 1,
        padding: 10,
    }
})