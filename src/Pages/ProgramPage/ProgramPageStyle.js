import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  headerCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerCircleAdd: {
    borderWidth: 0,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 6,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  container: {
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 16,
    paddingTop: 30,
  },
  loaderContainer: {
    paddingVertical: 10,
  },
  bottomsheet_title: {
    alignItems: 'center',
    marginBottom: 12,
  },
  bottomsheet_body: {
    gap: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  option_disabled: {
    opacity: 0.56,
  },
  option_text: {
    fontSize: 15,
  },
});
