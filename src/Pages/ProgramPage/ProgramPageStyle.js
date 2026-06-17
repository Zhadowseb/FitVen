import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  header_actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  header_import_button: {
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header_import_button_disabled: {
    opacity: 0.5,
  },
  header_import_text: {
    fontSize: 13,
    fontWeight: '700',
  },
  container: {
    borderWidth: 1,
    borderRadius: 8,
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
  option_text: {
    fontSize: 16,
  },
});
