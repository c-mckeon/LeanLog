// Exercise library offered in "Add Exercise → From library".
//
// `link` (optional): a demonstration page on ExRx.net, shown as "Demo ↗". Every link was
// checked to load; activities without a sensible page have none.
//
// What each set records: `fields` from 'sets', 'reps', 'weight' and 'custom'; anything without
// `fields` tracks sets, reps and weight. 'custom' is a box named by `customLabel` (keep it short:
// beside reps or weight the box is narrow). An exercise with only 'custom' has a single entry
// instead of sets, e.g. Floors for the stair climber.
//
// Each entry: { name, category, variations } where `variations` lists only real variations: ones
// different enough to track separately (Incline for Bench Press), not equipment or grip details.
// They're offered as tick boxes and stored on the user's exercise, the same as variations added
// later in the Exercise Editor. Categories match the app's
// standard ones and are recreated for the user if missing.
//
// To grow the library, add entries here. Keep variation names short and readable
// on their own (they show next to the exercise in the workout builder).

window.EXERCISE_LIBRARY = [
  // Upper Body Push
  { name: 'Bench Press', category: 'Upper Body Push', variations: ['Incline', 'Decline', 'Close grip'], link: 'https://exrx.net/WeightExercises/PectoralSternal/BBBenchPress' },
  { name: 'Overhead Press', category: 'Upper Body Push', variations: ['Seated', 'Push press'], link: 'https://exrx.net/WeightExercises/DeltoidAnterior/BBMilitaryPress' },
  { name: 'Push-Up', category: 'Upper Body Push', variations: ['Incline', 'Decline', 'Diamond'], link: 'https://exrx.net/WeightExercises/PectoralSternal/BWPushup' },
  { name: 'Dip', category: 'Upper Body Push', variations: ['Bench dip', 'Assisted'], link: 'https://exrx.net/WeightExercises/PectoralSternal/BWChestDip' },
  { name: 'Chest Fly', category: 'Upper Body Push', variations: ['Incline', 'Cable'], link: 'https://exrx.net/WeightExercises/PectoralSternal/DBFly' },
  { name: 'Lateral Raise', category: 'Upper Body Push', variations: ['Cable'], link: 'https://exrx.net/WeightExercises/DeltoidLateral/DBLateralRaise' },
  { name: 'Front Raise', category: 'Upper Body Push', variations: [], link: 'https://exrx.net/WeightExercises/DeltoidAnterior/DBFrontRaise' },
  { name: 'Tricep Extension', category: 'Upper Body Push', variations: ['Overhead', 'Skull crusher'], link: 'https://exrx.net/WeightExercises/Triceps/DBTriExt' },
  { name: 'Tricep Pushdown', category: 'Upper Body Push', variations: ['Rope'], link: 'https://exrx.net/WeightExercises/Triceps/CBPushdown' },
  { name: 'Landmine Press', category: 'Upper Body Push', variations: ['Single arm'] },

  // Upper Body Pull
  { name: 'Pull-Up', category: 'Upper Body Pull', variations: ['Chin-up', 'Neutral grip', 'Assisted'], link: 'https://exrx.net/WeightExercises/LatissimusDorsi/BWPullup' },
  { name: 'Row', category: 'Upper Body Pull', variations: ['Single-arm dumbbell', 'Seated cable', 'Chest-supported'], link: 'https://exrx.net/WeightExercises/BackGeneral/BBBentOverRow' },
  { name: 'Lat Pulldown', category: 'Upper Body Pull', variations: ['Close grip', 'Underhand'], link: 'https://exrx.net/WeightExercises/LatissimusDorsi/CBFrontPulldown' },
  { name: 'Bicep Curl', category: 'Upper Body Pull', variations: ['Hammer', 'Preacher', 'Incline'], link: 'https://exrx.net/WeightExercises/Biceps/DBCurl' },
  { name: 'Face Pull', category: 'Upper Body Pull', variations: [], link: 'https://exrx.net/WeightExercises/DeltoidPosterior/CBStandingRearDeltRowRope' },
  { name: 'Rear Delt Fly', category: 'Upper Body Pull', variations: [], link: 'https://exrx.net/WeightExercises/DeltoidPosterior/DBRearLateralRaise' },
  { name: 'Shrug', category: 'Upper Body Pull', variations: [], link: 'https://exrx.net/WeightExercises/TrapeziusUpper/BBShrug' },
  { name: 'Inverted Row', category: 'Upper Body Pull', variations: ['Feet elevated'], link: 'https://exrx.net/WeightExercises/BackGeneral/BWSupineRow' },
  { name: 'Straight-Arm Pulldown', category: 'Upper Body Pull', variations: [] },
  { name: 'Wrist Curl', category: 'Upper Body Pull', variations: ['Reverse'], link: 'https://exrx.net/WeightExercises/WristFlexors/BBWristCurl' },

  // Legs
  { name: 'Squat', category: 'Legs', variations: ['Front squat', 'Goblet', 'Hack squat'], link: 'https://exrx.net/WeightExercises/GluteusMaximus/BBSquat' },
  { name: 'Deadlift', category: 'Legs', variations: ['Romanian', 'Sumo', 'Trap bar'], link: 'https://exrx.net/WeightExercises/GluteusMaximus/BBDeadlift' },
  { name: 'Lunge', category: 'Legs', variations: ['Reverse', 'Walking', 'Lateral'], link: 'https://exrx.net/WeightExercises/GluteusMaximus/DBLunge' },
  { name: 'Split Squat', category: 'Legs', variations: ['Bulgarian'], link: 'https://exrx.net/WeightExercises/GluteusMaximus/DBSplitSquat' },
  { name: 'Leg Press', category: 'Legs', variations: ['Single leg'], link: 'https://exrx.net/WeightExercises/GluteusMaximus/LV45LegPress' },
  { name: 'Leg Extension', category: 'Legs', variations: [], link: 'https://exrx.net/WeightExercises/Quadriceps/LVLegExtension' },
  { name: 'Leg Curl', category: 'Legs', variations: ['Seated', 'Nordic'], link: 'https://exrx.net/WeightExercises/Hamstrings/LVLyingLegCurl' },
  { name: 'Hip Thrust', category: 'Legs', variations: ['Glute bridge', 'Single leg'], link: 'https://exrx.net/WeightExercises/GluteusMaximus/BBHipThrust' },
  { name: 'Calf Raise', category: 'Legs', variations: ['Seated', 'Single leg'], link: 'https://exrx.net/WeightExercises/Gastrocnemius/BBStandingCalfRaise' },
  { name: 'Step-Up', category: 'Legs', variations: ['Lateral'], link: 'https://exrx.net/WeightExercises/GluteusMaximus/DBStepUp' },
  { name: 'Good Morning', category: 'Legs', variations: [], link: 'https://exrx.net/WeightExercises/Hamstrings/BBGoodMorning' },
  { name: 'Hip Abduction', category: 'Legs', variations: [], link: 'https://exrx.net/WeightExercises/HipAbductor/LVSeatedHipAbduction' },
  { name: 'Hip Adduction', category: 'Legs', variations: ['Copenhagen plank'], link: 'https://exrx.net/WeightExercises/HipAdductors/LVSeatedHipAdduction' },
  { name: 'Kettlebell Swing', category: 'Legs', variations: ['Single arm'], link: 'https://exrx.net/WeightExercises/Kettlebell/KBSwing' },

  // Core & Functional
  { name: 'Plank', category: 'Core & Functional', variations: ['Side plank'], fields: ['sets', 'weight', 'custom'], customLabel: 'Secs', link: 'https://exrx.net/WeightExercises/RectusAbdominis/BWFrontPlank' },
  { name: 'Leg Raise', category: 'Core & Functional', variations: ['Knee raise', 'Lying'], fields: ['sets', 'reps'], link: 'https://exrx.net/WeightExercises/HipFlexors/WtHangLegRaise' },
  { name: 'Crunch', category: 'Core & Functional', variations: ['Cable', 'Reverse'], link: 'https://exrx.net/WeightExercises/RectusAbdominis/BWCrunch' },
  { name: 'Loaded Carry', category: 'Core & Functional', variations: ["Farmer's carry", 'Suitcase carry'], fields: ['sets', 'weight', 'custom'], customLabel: 'Metres' },
  { name: 'Russian Twist', category: 'Core & Functional', variations: [] },
  { name: 'Ab Wheel Rollout', category: 'Core & Functional', variations: [], fields: ['sets', 'reps'] },
  { name: 'Pallof Press', category: 'Core & Functional', variations: [] },
  { name: 'Dead Bug', category: 'Core & Functional', variations: [], fields: ['sets', 'reps'] },
  { name: 'Back Extension', category: 'Core & Functional', variations: ['Reverse hyper'], link: 'https://exrx.net/WeightExercises/Hamstrings/Wt45Hyperextension' },
  { name: 'Woodchop', category: 'Core & Functional', variations: ['Low to high'] },
  { name: 'Burpee', category: 'Core & Functional', variations: [], fields: ['sets', 'reps'] },
  { name: 'Box Jump', category: 'Core & Functional', variations: ['Depth jump'], fields: ['sets', 'reps'], link: 'https://exrx.net/Plyometrics/BoxJump' },
  { name: 'Turkish Get-Up', category: 'Core & Functional', variations: [], link: 'https://exrx.net/WeightExercises/Kettlebell/KBTurkishGetUp' },
  { name: 'Sled Push', category: 'Core & Functional', variations: ['Sled pull'], fields: ['sets', 'weight', 'custom'], customLabel: 'Metres' },
  { name: 'Battle Ropes', category: 'Core & Functional', variations: ['Slams'], fields: ['sets', 'custom'], customLabel: 'Secs' },

  // Activity & Conditioning
  { name: 'Running', category: 'Activity & Conditioning', variations: ['Treadmill', 'Trail'], fields: ['custom'], customLabel: 'Distance (km)' },
  { name: 'Cycling', category: 'Activity & Conditioning', variations: ['Indoor'], fields: ['custom'], customLabel: 'Distance (km)' },
  { name: 'Swimming', category: 'Activity & Conditioning', variations: ['Freestyle', 'Breaststroke'], fields: ['custom'], customLabel: 'Laps' },
  { name: 'Rowing', category: 'Activity & Conditioning', variations: [], fields: ['custom'], customLabel: 'Distance (m)' },
  { name: 'Walking', category: 'Activity & Conditioning', variations: ['Treadmill', 'Rucking'], fields: ['custom'], customLabel: 'Distance (km)' },
  { name: 'Hiking', category: 'Activity & Conditioning', variations: [], fields: ['custom'], customLabel: 'Distance (km)' },
  { name: 'Elliptical', category: 'Activity & Conditioning', variations: [], fields: ['custom'], customLabel: 'Minutes' },
  { name: 'Stair Climber', category: 'Activity & Conditioning', variations: [], fields: ['custom'], customLabel: 'Floors' },
  { name: 'Jump Rope', category: 'Activity & Conditioning', variations: ['Double unders'], fields: ['sets', 'reps'] },
  { name: 'Ski Erg', category: 'Activity & Conditioning', variations: [], fields: ['custom'], customLabel: 'Distance (m)' },
  { name: 'Assault Bike', category: 'Activity & Conditioning', variations: [], fields: ['custom'], customLabel: 'Calories' },
  { name: 'Yoga', category: 'Activity & Conditioning', variations: [], fields: ['custom'], customLabel: 'Minutes' },
  { name: 'Mobility', category: 'Activity & Conditioning', variations: [], fields: ['custom'], customLabel: 'Minutes' },
  { name: 'Sports', category: 'Activity & Conditioning', variations: ['Football', 'Tennis', 'Padel', 'Basketball'], fields: ['custom'], customLabel: 'Minutes' }
];
