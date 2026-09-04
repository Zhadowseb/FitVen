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

    stateBlock: {
        paddingHorizontal: 28,
        paddingVertical: 40,
        alignItems: 'center',
        gap: 10,
    },

    stateTitle: {
        textAlign: 'center',
    },

    stateText: {
        maxWidth: 310,
        fontSize: 13,
        lineHeight: 19,
        textAlign: 'center',
    },

    stateAction: {
        minWidth: 140,
        minHeight: 44,
        borderRadius: 22,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },

    stateActionText: {
        fontSize: 13,
        lineHeight: 17,
        fontWeight: '900',
    },
});
