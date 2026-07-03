import Run from "../Run/Run";

const Walk = ({ workout_id, restartRequestKey }) => (
  <Run
    workout_id={workout_id}
    restartRequestKey={restartRequestKey}
    forcedRunFlow="custom"
    activityLabel="Walk"
  />
);

export default Walk;
