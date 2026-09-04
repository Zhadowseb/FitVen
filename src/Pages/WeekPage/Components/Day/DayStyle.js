import { StyleSheet } from 'react-native';

export default StyleSheet.create({

  circle: {
    justifyContent: "center",
    alignItems: "center",
  },

  card: {
    marginVertical: 3,
    marginHorizontal: 5,
    borderRadius: 30,
    paddingLeft: 0,
  },

  day: {
    width: 110,
    alignItems: "center",
    justifyContent: "center",
    overflow: "show",
    flexDirection: "column"
  },

  workouts: {
    flexGrow: 1,
    minWidth: 0,
    alignItems: "flex-start",
    overflow: "hidden",
  },

  focus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: "center",
    borderTopRightRadius: 15,
    borderBottomRightRadius: 15,
  },

  options: {
    flex: 0.2,
    alignItems: "flex-end",
    justifyContent: "center",
    marginRight: 5,
  },

  text: {
    zIndex: 2,
  },

  svg: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000000',
  },

  container_row: {
    flex: 0.9,
    flexDirection: 'row',
  },

  touchable: {
    flex: 1,
  },

  bottomsheet_title: {
    borderBottomWidth: 1,
    borderBottomColor: "#2e2e2eff",
    paddingBottom: 30,
  },
  bottomsheet_body: {
    justifyContent: "center",
    padding: 20,
    paddingLeft: 0,
  },

  option_text: {
    paddingLeft: 10,
    fontWeight: 600,
    fontSize: 15,
  },

  option: {
    flexDirection: "row",
    paddingTop: 20,
  },


});