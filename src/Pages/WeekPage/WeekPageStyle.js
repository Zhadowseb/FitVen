import { StyleSheet } from 'react-native';

export default StyleSheet.create({

    container: {
        flex: 1,
    },

    headerTitleGroup: {
        alignItems: 'center',
        justifyContent: 'center',
    },

    headerEyebrow: {
        fontWeight: '800',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 2,
    },

    scroll: {
        flex: 1,
    },

    // The seven days used to be a flex:1 column, which squeezed them all into
    // one screen height. They scroll now, so the states can share the space.
    body: {
        paddingBottom: 20,
    },

});
