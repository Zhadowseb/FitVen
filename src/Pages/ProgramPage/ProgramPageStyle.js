import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  header_actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  header_menu_button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
  option_disabled: {
    opacity: 0.56,
  },
  option_text: {
    fontSize: 16,
  },
});
