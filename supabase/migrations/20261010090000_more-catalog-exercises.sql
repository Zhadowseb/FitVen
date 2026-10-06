-- 402 more exercises in the catalog, next to the 89 we had.
--
-- Each new exercise takes its muscles from the one of ours it is closest to,
-- named in the second column: "Front Squat" gets what "Squat" has, "Cable
-- Lateral Raise" what "Lateral Raise" has. The body map then shows a new
-- exercise the way it shows that one, and correcting a template's muscles
-- later is a separate, deliberate change - this file copies them once.
-- The hip abduction ones have no template of ours, so they get Gluteus
-- Medius (primary) and Gluteus Maximus (secondary) directly ('ABDUCTION').
--
-- Every row is official with the default columns every catalog exercise has.
-- The phones get them on their next catalog sync; no release is needed. A
-- phone with a custom exercise of the same name keeps the custom one: the
-- local catalog insert is INSERT OR IGNORE.
--
-- Can run twice: a name already in the catalog, in any case, is left alone,
-- and so is a muscle row an exercise already has.

begin;

create temporary table new_catalog_exercise (
  name text primary key,
  template text not null
);

insert into new_catalog_exercise (name, template) values
  ('Banded Clamshell', 'ABDUCTION'),
  ('Banded Fire Hydrant', 'ABDUCTION'),
  ('Banded Lateral Walk', 'ABDUCTION'),
  ('Banded Seated Hip Abduction', 'ABDUCTION'),
  ('Banded Standing Hip Abduction', 'ABDUCTION'),
  ('Banded Sumo Walk', 'ABDUCTION'),
  ('Clamshells', 'ABDUCTION'),
  ('Machine Hip Abduction', 'ABDUCTION'),
  ('Side-Lying Hip Abduction', 'ABDUCTION'),
  ('Barbell Ab Rollout', 'Ab Wheel'),
  ('Barbell Rear Delt Row', 'Barbell Row'),
  ('Bench Pull', 'Barbell Row'),
  ('Bent-Over Dumbbell Row', 'Barbell Row'),
  ('Bent-Over EZ-Bar Row', 'Barbell Row'),
  ('Cable Bent-Over Row', 'Barbell Row'),
  ('Chest-Supported Kettlebell Row', 'Barbell Row'),
  ('Chest-Supported Smith Machine Row', 'Barbell Row'),
  ('Double Kettlebell Rear Delt Row', 'Barbell Row'),
  ('Double Kettlebell Row', 'Barbell Row'),
  ('Dumbbell Bench Pull', 'Barbell Row'),
  ('EZ Bar Reverse Grip Row', 'Barbell Row'),
  ('One Arm Kettlebell Row', 'Barbell Row'),
  ('Pendlay Row', 'Barbell Row'),
  ('Reverse Grip Bent Over Row', 'Barbell Row'),
  ('Single-Arm Chest-Supported Dumbbell Row', 'Barbell Row'),
  ('Sled Row', 'Barbell Row'),
  ('Smith Machine Bent Over Row', 'Barbell Row'),
  ('Smith Machine Reverse Grip Bent Over Row', 'Barbell Row'),
  ('Crab Dips', 'Bench Dips'),
  ('Reverse Plank Dips', 'Bench Dips'),
  ('Cable Chest Press', 'Bench Press'),
  ('Dumbbell Floor Press', 'Bench Press'),
  ('EZ-Bar Bench Press', 'Bench Press'),
  ('Floor EZ-Bar Press', 'Bench Press'),
  ('Floor Press', 'Bench Press'),
  ('Kettlebell Floor Press', 'Bench Press'),
  ('One Arm Kettlebell Floor Glute Bridge Press', 'Bench Press'),
  ('One Arm Kettlebell Floor Press', 'Bench Press'),
  ('Paused Bench Press', 'Bench Press'),
  ('Spoto Press', 'Bench Press'),
  ('TRX Chest Press', 'Bench Press'),
  ('Wide-Grip Bench Press', 'Bench Press'),
  ('Barbell Curl', 'Bicep Curl'),
  ('Cheat Curl', 'Bicep Curl'),
  ('Close-Grip Barbell Curl', 'Bicep Curl'),
  ('Close-Grip EZ-Bar Curl', 'Bicep Curl'),
  ('Double Kettlebell Bicep Curl', 'Bicep Curl'),
  ('Drag Curl', 'Bicep Curl'),
  ('Machine Bicep Curl', 'Bicep Curl'),
  ('One Arm Kettlebell Bicep Curl', 'Bicep Curl'),
  ('Seated Dumbbell Curl', 'Bicep Curl'),
  ('Strict Curl', 'Bicep Curl'),
  ('TRX Bicep Curl', 'Bicep Curl'),
  ('Barbell Lunge', 'Bulgarian Split Squat'),
  ('Barbell Reverse Lunge', 'Bulgarian Split Squat'),
  ('Bodyweight Reverse Lunge', 'Bulgarian Split Squat'),
  ('Cossack Squat', 'Bulgarian Split Squat'),
  ('Dumbbell Lunge', 'Bulgarian Split Squat'),
  ('Dumbbell Pistol Squat', 'Bulgarian Split Squat'),
  ('Dumbbell Split Squat', 'Bulgarian Split Squat'),
  ('Kettlebell Bulgarian Split Squat', 'Bulgarian Split Squat'),
  ('Kettlebell Goblet Lunge', 'Bulgarian Split Squat'),
  ('Kettlebell Pistol Squat', 'Bulgarian Split Squat'),
  ('Kettlebell Reverse Lunge', 'Bulgarian Split Squat'),
  ('Kettlebell Rotational Lunge', 'Bulgarian Split Squat'),
  ('Pistol Squat', 'Bulgarian Split Squat'),
  ('Plyo Lunge', 'Bulgarian Split Squat'),
  ('Reverse Lunge', 'Bulgarian Split Squat'),
  ('Side Lunge', 'Bulgarian Split Squat'),
  ('Smith Machine Bulgarian Split Squat', 'Bulgarian Split Squat'),
  ('Smith Machine Reverse Lunge', 'Bulgarian Split Squat'),
  ('Smith Machine Split Squat', 'Bulgarian Split Squat'),
  ('Split Squat', 'Bulgarian Split Squat'),
  ('Step Ups', 'Bulgarian Split Squat'),
  ('TRX Lunge', 'Bulgarian Split Squat'),
  ('TRX Pistol Squat', 'Bulgarian Split Squat'),
  ('Barbell Overhead Extension', 'Cable Overhead Tricep Extension'),
  ('Dumbbell Tricep Extension', 'Cable Overhead Tricep Extension'),
  ('EZ-Bar Overhead Tricep Extension', 'Cable Overhead Tricep Extension'),
  ('Kettlebell Overhead Tricep Extension', 'Cable Overhead Tricep Extension'),
  ('Machine Triceps Extension', 'Cable Overhead Tricep Extension'),
  ('Overhead Tricep Extension', 'Cable Overhead Tricep Extension'),
  ('Seated Dumbbell Tricep Extension', 'Cable Overhead Tricep Extension'),
  ('TRX Triceps Extension', 'Cable Overhead Tricep Extension'),
  ('Decline Dumbbell Fly', 'Chest Flies'),
  ('Dumbbell Svend Press', 'Chest Flies'),
  ('Incline Dumbbell Fly', 'Chest Flies'),
  ('Kettlebell Svend Press', 'Chest Flies'),
  ('Machine Chest Fly', 'Chest Flies'),
  ('Single Dumbbell Svend Press', 'Chest Flies'),
  ('Svend Press', 'Chest Flies'),
  ('Close Grip Push Ups', 'Close Grip Bench Press'),
  ('Close-Grip Dumbbell Bench Press', 'Close Grip Bench Press'),
  ('Close-Grip EZ-Bar Bench Press', 'Close Grip Bench Press'),
  ('Close-Grip Incline Bench Press', 'Close Grip Bench Press'),
  ('Diamond Push Ups', 'Close Grip Bench Press'),
  ('Kettlebell Close-Grip Floor Press', 'Close Grip Bench Press'),
  ('Bicycle Crunch', 'Crunches'),
  ('Cross-Body Crunch', 'Crunches'),
  ('Decline Crunch', 'Crunches'),
  ('Jackknife Sit-Up', 'Crunches'),
  ('Machine Seated Crunch', 'Crunches'),
  ('Reverse Crunches', 'Crunches'),
  ('Sit-Ups', 'Crunches'),
  ('V Ups', 'Crunches'),
  ('Weighted Wall Crunch', 'Crunches'),
  ('Air Bike', 'Cycling'),
  ('Clean', 'Deadlift'),
  ('Deficit Deadlift', 'Deadlift'),
  ('Double Dumbbell Kickstand Deadlift', 'Deadlift'),
  ('Double Kettlebell Clean', 'Deadlift'),
  ('Double Kettlebell Dead Clean', 'Deadlift'),
  ('Double Kettlebell Dead Split Snatch', 'Deadlift'),
  ('Double Kettlebell Swing Snatch', 'Deadlift'),
  ('Dumbbell Deadlift', 'Deadlift'),
  ('Dumbbell Kickstand Deadlift', 'Deadlift'),
  ('Dumbbell Snatch', 'Deadlift'),
  ('Hang Clean', 'Deadlift'),
  ('Hang Power Clean', 'Deadlift'),
  ('Hex Bar Deadlift', 'Deadlift'),
  ('Kettlebell Deadlift', 'Deadlift'),
  ('Kettlebell Kickstand Deadlift', 'Deadlift'),
  ('Kettlebell Swing', 'Deadlift'),
  ('Kettlebell Swing Clean', 'Deadlift'),
  ('Muscle Snatch', 'Deadlift'),
  ('One Arm Kettlebell Swing', 'Deadlift'),
  ('One-Arm Dumbbell Swing', 'Deadlift'),
  ('Pause Deadlift', 'Deadlift'),
  ('Snatch', 'Deadlift'),
  ('Decline EZ-Bar Bench Press', 'Decline Bench Press'),
  ('Decline Push-Up', 'Decline Bench Press'),
  ('Smith Machine Decline Bench Press', 'Decline Bench Press'),
  ('Machine Assisted Dips', 'Dips'),
  ('Ring Dips', 'Dips'),
  ('Straight Bar Dips', 'Dips'),
  ('Weighted Dips', 'Dips'),
  ('Barbell Pullover', 'Dumbbell Pullover'),
  ('Bent Arm Barbell Pullover', 'Dumbbell Pullover'),
  ('Bent-Arm EZ-Bar Pullover', 'Dumbbell Pullover'),
  ('EZ Bar Pullover', 'Dumbbell Pullover'),
  ('Floor Kettlebell Pullover', 'Dumbbell Pullover'),
  ('Kettlebell Pullover', 'Dumbbell Pullover'),
  ('Plate Pullover', 'Dumbbell Pullover'),
  ('Band Pull Apart', 'Face Pull'),
  ('Dumbbell Face Pull', 'Face Pull'),
  ('Ring Face Pull', 'Face Pull'),
  ('TRX Face Pull', 'Face Pull'),
  ('Double Dumbbell Overhead Carry', 'Farmers Carry'),
  ('Double Kettlebell Overhead Carry', 'Farmers Carry'),
  ('Dumbbell Overhead Carry', 'Farmers Carry'),
  ('Kettlebell Farmer''s Walk', 'Farmers Carry'),
  ('Kettlebell Overhead Carry', 'Farmers Carry'),
  ('Suitcase Carry', 'Farmers Carry'),
  ('Barbell Front Raise', 'Front Raise'),
  ('Cable Front Raise', 'Front Raise'),
  ('EZ-Bar Front Raise', 'Front Raise'),
  ('Straight-Bar Cable Front Raise', 'Front Raise'),
  ('Banded Glute Bridge', 'Glute Bridge'),
  ('Barbell Glute Bridge', 'Glute Bridge'),
  ('Cable Glute Kickback', 'Glute Bridge'),
  ('Glute Kickback', 'Glute Bridge'),
  ('Reverse Tabletop Hip Pulses', 'Glute Bridge'),
  ('Single Leg Glute Bridge', 'Glute Bridge'),
  ('Stability Ball Hip Bridge', 'Glute Bridge'),
  ('Cable Hammer Curl', 'Hammer Curl'),
  ('Cross Body Hammer Curl', 'Hammer Curl'),
  ('Incline Hammer Curl', 'Hammer Curl'),
  ('Kettlebell Hammer Curl', 'Hammer Curl'),
  ('Preacher Hammer Curl', 'Hammer Curl'),
  ('Single-Arm Hammer Curl', 'Hammer Curl'),
  ('Ball Pike', 'Hanging Leg Raise'),
  ('Bench Leg Pull-In', 'Hanging Leg Raise'),
  ('Captain''s Chair Knee Raise', 'Hanging Leg Raise'),
  ('Captain''s Chair Leg Raise', 'Hanging Leg Raise'),
  ('Dead Bug', 'Hanging Leg Raise'),
  ('Dragon Flag', 'Hanging Leg Raise'),
  ('Flutter Kicks', 'Hanging Leg Raise'),
  ('Hanging Knee Raise', 'Hanging Leg Raise'),
  ('Hanging Pike', 'Hanging Leg Raise'),
  ('L Sit', 'Hanging Leg Raise'),
  ('Lying Leg Raise', 'Hanging Leg Raise'),
  ('Plank Knee Tuck', 'Hanging Leg Raise'),
  ('Scissor Kicks', 'Hanging Leg Raise'),
  ('Stability Ball Knee Tuck', 'Hanging Leg Raise'),
  ('Toes to Bar', 'Hanging Leg Raise'),
  ('V-Sit', 'Hanging Leg Raise'),
  ('Banded Hip Thrust', 'Hip Thrust'),
  ('Banded Kneeling Hip Thrust', 'Hip Thrust'),
  ('Dumbbell Hip Thrust', 'Hip Thrust'),
  ('Kettlebell Hip Thrust', 'Hip Thrust'),
  ('Plate-Loaded Glute Drive', 'Hip Thrust'),
  ('Smith Machine Hip Thrust', 'Hip Thrust'),
  ('Banded Standing Hip Adduction', 'Hip adduction'),
  ('Side Lying Hip Adduction', 'Hip adduction'),
  ('Incline EZ-Bar Bench Press', 'Incline Bench Press'),
  ('Incline Push-Up', 'Incline Bench Press'),
  ('Paused Incline Bench Press', 'Incline Bench Press'),
  ('Smith Machine Incline Bench Press', 'Incline Bench Press'),
  ('Behind-the-Neck Lat Pulldown', 'Lat Pulldown'),
  ('Close Grip Lat Pulldown', 'Lat Pulldown'),
  ('One-Arm Lat Pulldown', 'Lat Pulldown'),
  ('Reverse Grip Lat Pulldown', 'Lat Pulldown'),
  ('V-Bar Lat Pulldown', 'Lat Pulldown'),
  ('Bodyweight Lateral Raise', 'Lateral Raise'),
  ('Cable Lateral Raise', 'Lateral Raise'),
  ('Kettlebell Halo', 'Lateral Raise'),
  ('Plate-Loaded Lateral Raise', 'Lateral Raise'),
  ('Seated Dumbbell Lateral Raise', 'Lateral Raise'),
  ('Side-Lying Lateral Raise', 'Lateral Raise'),
  ('Single-Arm Plate-Loaded Lateral Raise', 'Lateral Raise'),
  ('Banded Standing Leg Curl', 'Leg Curl'),
  ('Nordic Hamstring Curl', 'Leg Curl'),
  ('Single Leg Lying Leg Curl', 'Leg Curl'),
  ('Stability Ball Leg Curl', 'Leg Curl'),
  ('TRX Hamstring Curl', 'Leg Curl'),
  ('Banded Terminal Knee Extension', 'Leg Extension'),
  ('Reverse Nordic Curl', 'Leg Extension'),
  ('Single Leg Extension', 'Leg Extension'),
  ('Close-Stance Leg Press', 'Leg Press'),
  ('High-Foot Leg Press', 'Leg Press'),
  ('Horizontal Leg Press', 'Leg Press'),
  ('Single Leg Press', 'Leg Press'),
  ('Wide-Stance Leg Press', 'Leg Press'),
  ('Machine Back Extension', 'Lower Back Extension'),
  ('Superman', 'Lower Back Extension'),
  ('Battle Rope Double Slam', 'Mountain Climbers'),
  ('Battle Ropes', 'Mountain Climbers'),
  ('Box Jump', 'Mountain Climbers'),
  ('Burpees', 'Mountain Climbers'),
  ('Jumping Jacks', 'Mountain Climbers'),
  ('Medicine Ball Slam', 'Mountain Climbers'),
  ('Behind the Neck Press', 'Overhead Press'),
  ('Bodyweight Overhead Press', 'Overhead Press'),
  ('Clean and Jerk', 'Overhead Press'),
  ('Double Kettlebell Clean and Press', 'Overhead Press'),
  ('Double Kettlebell Jerk', 'Overhead Press'),
  ('Double Kettlebell Overhead Press', 'Overhead Press'),
  ('Double Kettlebell Push Press', 'Overhead Press'),
  ('Double Kettlebell Split Jerk', 'Overhead Press'),
  ('Dumbbell Push Press', 'Overhead Press'),
  ('Handstand Push Ups', 'Overhead Press'),
  ('Kettlebell Lunge Press', 'Overhead Press'),
  ('Kettlebell Offset Reverse Lunge and Press', 'Overhead Press'),
  ('Kettlebell Turkish Get Ups', 'Overhead Press'),
  ('Landmine Press', 'Overhead Press'),
  ('Machine Shoulder Press', 'Overhead Press'),
  ('One Arm Kettlebell Push Press', 'Overhead Press'),
  ('One Arm Kettlebell Shoulder Press', 'Overhead Press'),
  ('One-Arm Dumbbell Push Press', 'Overhead Press'),
  ('One-Arm Kettlebell Bottoms-Up Press', 'Overhead Press'),
  ('One-Arm Landmine Press', 'Overhead Press'),
  ('Paused Overhead Press', 'Overhead Press'),
  ('Pike Push Ups', 'Overhead Press'),
  ('Push Jerk', 'Overhead Press'),
  ('Push Press', 'Overhead Press'),
  ('Seated Barbell Overhead Press', 'Overhead Press'),
  ('Seated Dumbbell Shoulder Press', 'Overhead Press'),
  ('Seated Smith Machine Shoulder Press', 'Overhead Press'),
  ('Single-Arm Machine Shoulder Press', 'Overhead Press'),
  ('Smith Machine Shoulder Press', 'Overhead Press'),
  ('Split Jerk', 'Overhead Press'),
  ('Thruster', 'Overhead Press'),
  ('Single Arm Tricep Pushdown', 'Overhead Triceps Pushdown'),
  ('V-Bar Tricep Pushdown', 'Overhead Triceps Pushdown'),
  ('Bear Crawl', 'Plank'),
  ('Bird-Dog', 'Plank'),
  ('Cable Pallof Press', 'Plank'),
  ('High Plank', 'Plank'),
  ('Reverse Plank', 'Plank'),
  ('Side Plank', 'Plank'),
  ('Side Plank with Leg Lift', 'Plank'),
  ('TRX Plank', 'Plank'),
  ('TRX Side Plank', 'Plank'),
  ('Barbell Preacher Curl', 'Preacher Curl'),
  ('EZ Bar Spider Curl', 'Preacher Curl'),
  ('Kettlebell Concentration Curl', 'Preacher Curl'),
  ('Machine Preacher Curl', 'Preacher Curl'),
  ('Spider Curl', 'Preacher Curl'),
  ('Archer Pull Ups', 'Pull up'),
  ('Assisted Pull Ups', 'Pull up'),
  ('Back Lever', 'Pull up'),
  ('Band Assisted Pull Ups', 'Pull up'),
  ('Behind-the-Neck Pull-Up', 'Pull up'),
  ('Close-Grip Pull-Ups', 'Pull up'),
  ('Dead Hang', 'Pull up'),
  ('Front Lever', 'Pull up'),
  ('Human Flag', 'Pull up'),
  ('Muscle Ups', 'Pull up'),
  ('Negative Pull Ups', 'Pull up'),
  ('Neutral Grip Pull Ups', 'Pull up'),
  ('Pause Pull-Up', 'Pull up'),
  ('Ring Dead Hang', 'Pull up'),
  ('Ring Muscle-Up', 'Pull up'),
  ('Rope Climb', 'Pull up'),
  ('Scapular Pull Ups', 'Pull up'),
  ('Weighted Pull-Up', 'Pull up'),
  ('Wide Grip Pull Ups', 'Pull up'),
  ('Archer Push Ups', 'Push-ups'),
  ('Clap Push-Ups', 'Push-ups'),
  ('Deficit Push Ups', 'Push-ups'),
  ('Knee Push Ups', 'Push-ups'),
  ('Planche', 'Push-ups'),
  ('Plyo Push-Up', 'Push-ups'),
  ('Pseudo Planche Push Ups', 'Push-ups'),
  ('Ring Push-Up', 'Push-ups'),
  ('Stability Ball Push-Up', 'Push-ups'),
  ('Stability Ball Push-Up (Hands on Ball)', 'Push-ups'),
  ('Wall Push Ups', 'Push-ups'),
  ('Wide Grip Push Ups', 'Push-ups'),
  ('TRX Y-Fly', 'Rear Delt Flies'),
  ('Dumbbell Reverse Curl', 'Reverse Curl'),
  ('EZ-Bar Reverse Curl', 'Reverse Curl'),
  ('Zottman Curl', 'Reverse Curl'),
  ('Banded Good Morning', 'Romanian Deadlift'),
  ('Banded Romanian Deadlift', 'Romanian Deadlift'),
  ('Bodyweight Good Morning', 'Romanian Deadlift'),
  ('Cable Pull-Through', 'Romanian Deadlift'),
  ('Dumbbell Romanian Deadlift', 'Romanian Deadlift'),
  ('EZ-Bar Romanian Deadlift', 'Romanian Deadlift'),
  ('Good Morning', 'Romanian Deadlift'),
  ('Jefferson Curl', 'Romanian Deadlift'),
  ('Kettlebell Single Leg Deadlift', 'Romanian Deadlift'),
  ('One-Arm Single-Leg Dumbbell Romanian Deadlift', 'Romanian Deadlift'),
  ('One-Arm Single-Leg Kettlebell Romanian Deadlift', 'Romanian Deadlift'),
  ('Single Leg Romanian Deadlift', 'Romanian Deadlift'),
  ('Smith Machine Good Morning', 'Romanian Deadlift'),
  ('Smith Machine Romanian Deadlift', 'Romanian Deadlift'),
  ('Stiff Leg Deadlift', 'Romanian Deadlift'),
  ('SkiErg', 'Rowing'),
  ('Heel Flicks', 'Running'),
  ('Heel-to-Toe Walk', 'Running'),
  ('High Knees', 'Running'),
  ('Incline Treadmill Walk', 'Running'),
  ('Walking', 'Running'),
  ('Dumbbell Side Bend', 'Russian Twist'),
  ('Dumbbell Windmill', 'Russian Twist'),
  ('Kettlebell Russian Twist', 'Russian Twist'),
  ('Kettlebell Windmills', 'Russian Twist'),
  ('Seated Spinal Twist', 'Russian Twist'),
  ('Standing Side Bend', 'Russian Twist'),
  ('Inverted Row', 'Seated Cable Row'),
  ('Kneeling Cable Row', 'Seated Cable Row'),
  ('Ring Row', 'Seated Cable Row'),
  ('Rings Inverted Row', 'Seated Cable Row'),
  ('TRX Row', 'Seated Cable Row'),
  ('Wide Grip Seated Cable Row', 'Seated Cable Row'),
  ('Behind the Back Barbell Shrug', 'Shrugs'),
  ('Chest Supported Dumbbell Shrug', 'Shrugs'),
  ('Dumbbell Shrug', 'Shrugs'),
  ('EZ-Bar Shrug', 'Shrugs'),
  ('Kettlebell Shrug', 'Shrugs'),
  ('Plate-Loaded Shrug', 'Shrugs'),
  ('Smith Machine Shrug', 'Shrugs'),
  ('Dumbbell Skull Crusher', 'Skullcrusher'),
  ('EZ-Bar Lying Triceps Extension', 'Skullcrusher'),
  ('Kettlebell Skull Crusher', 'Skullcrusher'),
  ('Lying Tricep Extension', 'Skullcrusher'),
  ('Banded Squat', 'Squat'),
  ('Bodyweight Squat', 'Squat'),
  ('Box Squat', 'Squat'),
  ('Dumbbell Front Squat', 'Squat'),
  ('Dumbbell Somersault Squat', 'Squat'),
  ('Dumbbell Squat', 'Squat'),
  ('Dumbbell Sumo Squat', 'Squat'),
  ('Front Squat', 'Squat'),
  ('Heel-Elevated Squat', 'Squat'),
  ('Jump Squat', 'Squat'),
  ('Kettlebell Squat', 'Squat'),
  ('One Arm Kettlebell Front Squat', 'Squat'),
  ('Overhead Squat', 'Squat'),
  ('Pause Squat', 'Squat'),
  ('Smith Machine Front Squat', 'Squat'),
  ('Stability Ball Wall Squat', 'Squat'),
  ('Sumo Squat', 'Squat'),
  ('TRX Squat', 'Squat'),
  ('Wall Sit', 'Squat'),
  ('Barbell Calf Raise', 'Standing Calf Raise'),
  ('Bodyweight Calf Raise', 'Standing Calf Raise'),
  ('Donkey Calf Raise', 'Standing Calf Raise'),
  ('Dumbbell Calf Raise', 'Standing Calf Raise'),
  ('Hack Squat Calf Raise', 'Standing Calf Raise'),
  ('Machine Calf Raise', 'Standing Calf Raise'),
  ('Plate-Loaded Donkey Calf Raise', 'Standing Calf Raise'),
  ('Single Leg Calf Raise', 'Standing Calf Raise'),
  ('Smith Machine Calf Raise', 'Standing Calf Raise'),
  ('Kettlebell Sumo Deadlift', 'Sumo Deadlift'),
  ('Cable Tricep Kickback', 'Tricep Kickback'),
  ('One-Arm Kettlebell Tricep Kickback', 'Tricep Kickback'),
  ('Cable Upright Row', 'Upright Row'),
  ('Dumbbell Upright Row', 'Upright Row'),
  ('EZ-Bar Upright Row', 'Upright Row'),
  ('Kettlebell Sumo High Pull', 'Upright Row'),
  ('Smith Machine Upright Row', 'Upright Row'),
  ('Bilateral Dumbbell Wrist Curl', 'Wrist Curl'),
  ('Cable Wrist Curl', 'Wrist Curl'),
  ('Dumbbell Reverse Wrist Curl', 'Wrist Curl'),
  ('Dumbbell Wrist Curl', 'Wrist Curl'),
  ('EZ-Bar Wrist Curl', 'Wrist Curl'),
  ('Kettlebell Reverse Wrist Curl', 'Wrist Curl'),
  ('Kettlebell Wrist Curl', 'Wrist Curl'),
  ('Plate Pinch', 'Wrist Curl'),
  ('Wrist Roller', 'Wrist Curl');

do $$
declare
  exercise_id_has_default boolean;
  activation_id_has_default boolean;
begin
  select column_default is not null or is_identity = 'YES'
    into exercise_id_has_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'Exercise' and column_name = 'id';

  select column_default is not null or is_identity = 'YES'
    into activation_id_has_default
  from information_schema.columns
  where table_schema = 'public' and table_name = 'Muscle_Activation' and column_name = 'id';

  -- Every template has to be one of ours, or its exercises would get nothing.
  if exists (
    select 1 from new_catalog_exercise n
    where n.template <> 'ABDUCTION'
      and not exists (select 1 from public."Exercise" t where t.name = n.template)
  ) then
    raise exception 'A template is missing from public."Exercise".';
  end if;

  if exercise_id_has_default then
    insert into public."Exercise" (name, default_visible_columns, official)
    select n.name, '{"rpe": false, "set": true, "done": true, "note": false, "reps": true, "rest": true, "weight": true, "rm_percentage": false}', true
    from new_catalog_exercise n
    where not exists (
      select 1 from public."Exercise" e where lower(e.name) = lower(n.name)
    )
    order by n.name;
  else
    insert into public."Exercise" (id, name, default_visible_columns, official)
    select
      (select coalesce(max(id), 0) from public."Exercise")
        + row_number() over (order by n.name),
      n.name, '{"rpe": false, "set": true, "done": true, "note": false, "reps": true, "rest": true, "weight": true, "rm_percentage": false}', true
    from new_catalog_exercise n
    where not exists (
      select 1 from public."Exercise" e where lower(e.name) = lower(n.name)
    );
  end if;

  create temporary table new_catalog_activation on commit drop as
  select e.id as exercise_id, ma.muscle_id, ma.activation_percent, ma.activation_level
  from new_catalog_exercise n
  join public."Exercise" e on e.name = n.name
  join public."Exercise" t on t.name = n.template
  join public."Muscle_Activation" ma on ma.exercise_id = t.id
  union all
  select e.id, m.muscle_id, null, m.activation_level
  from new_catalog_exercise n
  join public."Exercise" e on e.name = n.name
  cross join (values (20, 'primary'), (19, 'secondary')) as m(muscle_id, activation_level)
  where n.template = 'ABDUCTION';

  delete from new_catalog_activation a
  where exists (
    select 1 from public."Muscle_Activation" m
    where m.exercise_id = a.exercise_id and m.muscle_id = a.muscle_id
  );

  if activation_id_has_default then
    insert into public."Muscle_Activation" (exercise_id, muscle_id, activation_percent, activation_level)
    select exercise_id, muscle_id, activation_percent, activation_level
    from new_catalog_activation;
  else
    insert into public."Muscle_Activation" (id, exercise_id, muscle_id, activation_percent, activation_level)
    select
      (select coalesce(max(id), 0) from public."Muscle_Activation")
        + row_number() over (order by exercise_id, muscle_id),
      exercise_id, muscle_id, activation_percent, activation_level
    from new_catalog_activation;
  end if;
end $$;

commit;

-- The result. Expected: 402 new exercises, each with at least one muscle.
select
  (select count(*) from new_catalog_exercise) as new_exercises,
  (select count(*) from public."Exercise" e
     join new_catalog_exercise n on n.name = e.name) as in_catalog,
  (select count(*) from new_catalog_exercise n
     join public."Exercise" e on e.name = n.name
     where not exists (
       select 1 from public."Muscle_Activation" m where m.exercise_id = e.id
     )) as without_muscles,
  (select count(*) from public."Exercise") as catalog_total;
