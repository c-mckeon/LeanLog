// Exercise library offered in "Add Exercise → From library".
//
// Each entry: { name, category, variations } where `variations` groups common
// variations by type (Equipment, Angle, Grip...). The groups only organise the
// picker; the user's exercise stores the chosen names as a flat list, the same as
// variations added later in the Exercise Editor. Categories match the app's
// standard ones and are recreated for the user if missing.
//
// To grow the library, add entries here. Keep variation names short and readable
// on their own (they show next to the exercise in the workout builder).
// Variations offered for an exercise made with "Create your own", grouped the same way.
window.COMMON_VARIATIONS = {
  Equipment: ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Kettlebell', 'Bodyweight', 'Band'],
  Position: ['Incline', 'Decline', 'Seated', 'Standing'],
  'Grip & stance': ['Wide', 'Close', 'Neutral grip', 'Single arm', 'Single leg'],
  Tempo: ['Paused', 'Slow lowering']
};

window.EXERCISE_LIBRARY = [
  // Upper Body Push
  { name: 'Bench Press', category: 'Upper Body Push', variations: { Equipment: ['Barbell', 'Dumbbell', 'Smith machine', 'Machine'], Angle: ['Incline', 'Decline'], Grip: ['Close grip', 'Wide grip'], Tempo: ['Paused'] } },
  { name: 'Overhead Press', category: 'Upper Body Push', variations: { Equipment: ['Barbell', 'Dumbbell', 'Machine', 'Kettlebell'], Position: ['Seated', 'Standing'], Style: ['Push press', 'Arnold press'] } },
  { name: 'Push-Up', category: 'Upper Body Push', variations: { Angle: ['Incline', 'Decline'], 'Hand position': ['Diamond', 'Wide', 'Archer'], Load: ['Weighted', 'Deficit'] } },
  { name: 'Dip', category: 'Upper Body Push', variations: { Setup: ['Parallel bars', 'Bench', 'Ring', 'Machine'], Load: ['Weighted', 'Assisted'] } },
  { name: 'Chest Fly', category: 'Upper Body Push', variations: { Equipment: ['Dumbbell', 'Cable', 'Machine (pec deck)'], Angle: ['Incline', 'Decline'] } },
  { name: 'Lateral Raise', category: 'Upper Body Push', variations: { Equipment: ['Dumbbell', 'Cable', 'Machine'], Position: ['Seated', 'Lean-away'] } },
  { name: 'Front Raise', category: 'Upper Body Push', variations: { Equipment: ['Dumbbell', 'Cable', 'Plate', 'Barbell'] } },
  { name: 'Tricep Extension', category: 'Upper Body Push', variations: { Equipment: ['Cable', 'Dumbbell', 'EZ bar'], Position: ['Overhead', 'Lying (skull crusher)'] } },
  { name: 'Tricep Pushdown', category: 'Upper Body Push', variations: { Attachment: ['Rope', 'Straight bar', 'V-bar'], Grip: ['Reverse grip', 'Single arm'] } },
  { name: 'Landmine Press', category: 'Upper Body Push', variations: { Position: ['Standing', 'Half-kneeling'], Arms: ['Single arm', 'Two arm'] } },

  // Upper Body Pull
  { name: 'Pull-Up', category: 'Upper Body Pull', variations: { Grip: ['Wide grip', 'Neutral grip', 'Chin-up'], Load: ['Weighted', 'Assisted', 'Negative'] } },
  { name: 'Row', category: 'Upper Body Pull', variations: { Equipment: ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'T-bar'], Style: ['Bent-over', 'Seated', 'Chest-supported', 'Pendlay'], Arms: ['Single arm'] } },
  { name: 'Lat Pulldown', category: 'Upper Body Pull', variations: { Grip: ['Wide grip', 'Close grip', 'Neutral grip', 'Reverse grip'], Arms: ['Single arm'] } },
  { name: 'Bicep Curl', category: 'Upper Body Pull', variations: { Equipment: ['Dumbbell', 'Barbell', 'EZ bar', 'Cable', 'Machine'], Style: ['Hammer', 'Preacher', 'Incline', 'Concentration', 'Spider'] } },
  { name: 'Face Pull', category: 'Upper Body Pull', variations: { Attachment: ['Rope', 'Band'], Position: ['Standing', 'Seated', 'Kneeling'] } },
  { name: 'Rear Delt Fly', category: 'Upper Body Pull', variations: { Equipment: ['Dumbbell', 'Cable', 'Machine (reverse pec deck)'], Position: ['Bent-over', 'Chest-supported'] } },
  { name: 'Shrug', category: 'Upper Body Pull', variations: { Equipment: ['Barbell', 'Dumbbell', 'Trap bar', 'Machine'] } },
  { name: 'Inverted Row', category: 'Upper Body Pull', variations: { Setup: ['Bar', 'Rings', 'TRX'], Load: ['Feet elevated', 'Weighted'] } },
  { name: 'Straight-Arm Pulldown', category: 'Upper Body Pull', variations: { Attachment: ['Straight bar', 'Rope'] } },
  { name: 'Wrist Curl', category: 'Upper Body Pull', variations: { Direction: ['Reverse'], Equipment: ['Barbell', 'Dumbbell'] } },

  // Legs
  { name: 'Squat', category: 'Legs', variations: { 'Bar position': ['High bar', 'Low bar', 'Front squat'], Equipment: ['Goblet', 'Smith machine', 'Safety bar', 'Hack squat'], Tempo: ['Paused', 'Box squat'] } },
  { name: 'Deadlift', category: 'Legs', variations: { Style: ['Conventional', 'Sumo', 'Romanian', 'Stiff-leg'], Equipment: ['Trap bar', 'Dumbbell', 'Deficit', 'Rack pull'] } },
  { name: 'Lunge', category: 'Legs', variations: { Direction: ['Forward', 'Reverse', 'Walking', 'Lateral'], Equipment: ['Dumbbell', 'Barbell'] } },
  { name: 'Split Squat', category: 'Legs', variations: { Style: ['Bulgarian', 'Front-foot elevated'], Equipment: ['Dumbbell', 'Barbell', 'Smith machine'] } },
  { name: 'Leg Press', category: 'Legs', variations: { 'Foot position': ['High stance', 'Low stance', 'Narrow', 'Wide'], Legs: ['Single leg'] } },
  { name: 'Leg Extension', category: 'Legs', variations: { Legs: ['Single leg'], Tempo: ['Paused'] } },
  { name: 'Leg Curl', category: 'Legs', variations: { Position: ['Lying', 'Seated', 'Standing'], Style: ['Nordic'], Legs: ['Single leg'] } },
  { name: 'Hip Thrust', category: 'Legs', variations: { Equipment: ['Barbell', 'Machine', 'Band'], Style: ['Glute bridge'], Legs: ['Single leg'] } },
  { name: 'Calf Raise', category: 'Legs', variations: { Position: ['Standing', 'Seated'], Equipment: ['Machine', 'Smith machine', 'Leg press', 'Dumbbell'], Legs: ['Single leg'] } },
  { name: 'Step-Up', category: 'Legs', variations: { Equipment: ['Dumbbell', 'Barbell'], Direction: ['Lateral'] } },
  { name: 'Good Morning', category: 'Legs', variations: { Position: ['Standing', 'Seated'] } },
  { name: 'Hip Abduction', category: 'Legs', variations: { Equipment: ['Machine', 'Cable', 'Band'] } },
  { name: 'Hip Adduction', category: 'Legs', variations: { Equipment: ['Machine', 'Cable', 'Copenhagen plank'] } },
  { name: 'Kettlebell Swing', category: 'Legs', variations: { Style: ['Russian', 'American'], Arms: ['Single arm'] } },

  // Core & Functional
  { name: 'Plank', category: 'Core & Functional', variations: { Style: ['Side plank', 'RKC plank', 'Plank with reach'], Load: ['Weighted'] } },
  { name: 'Leg Raise', category: 'Core & Functional', variations: { Position: ['Hanging', 'Lying', "Captain's chair"], Style: ['Knee raise', 'Toes to bar'] } },
  { name: 'Crunch', category: 'Core & Functional', variations: { Equipment: ['Cable', 'Machine', 'Decline bench'], Style: ['Reverse', 'Bicycle'] } },
  { name: 'Loaded Carry', category: 'Core & Functional', variations: { Style: ["Farmer's carry", 'Suitcase carry', 'Overhead carry', 'Front-rack carry'] } },
  { name: 'Russian Twist', category: 'Core & Functional', variations: { Load: ['Weighted', 'Medicine ball'] } },
  { name: 'Ab Wheel Rollout', category: 'Core & Functional', variations: { Position: ['Kneeling', 'Standing'] } },
  { name: 'Pallof Press', category: 'Core & Functional', variations: { Equipment: ['Cable', 'Band'], Position: ['Standing', 'Half-kneeling'] } },
  { name: 'Dead Bug', category: 'Core & Functional', variations: { Load: ['Weighted', 'Band'] } },
  { name: 'Back Extension', category: 'Core & Functional', variations: { Angle: ['45°', '90°'], Style: ['Reverse hyper'], Load: ['Weighted'] } },
  { name: 'Woodchop', category: 'Core & Functional', variations: { Direction: ['High to low', 'Low to high'], Equipment: ['Cable', 'Band', 'Medicine ball'] } },
  { name: 'Burpee', category: 'Core & Functional', variations: { Style: ['No push-up', 'Burpee box jump'] } },
  { name: 'Box Jump', category: 'Core & Functional', variations: { Style: ['Seated', 'Lateral', 'Depth jump'] } },
  { name: 'Turkish Get-Up', category: 'Core & Functional', variations: { Equipment: ['Kettlebell', 'Dumbbell'] } },
  { name: 'Sled Push', category: 'Core & Functional', variations: { Style: ['Sled pull', 'Sled drag'] } },
  { name: 'Battle Ropes', category: 'Core & Functional', variations: { Style: ['Waves', 'Slams', 'Alternating'] } },

  // Activity & Conditioning
  { name: 'Running', category: 'Activity & Conditioning', variations: { Setting: ['Treadmill', 'Outdoor', 'Track', 'Trail'], Type: ['Easy', 'Tempo', 'Intervals', 'Sprints'] } },
  { name: 'Cycling', category: 'Activity & Conditioning', variations: { Setting: ['Indoor', 'Outdoor', 'Spin class'], Type: ['Easy', 'Intervals'] } },
  { name: 'Swimming', category: 'Activity & Conditioning', variations: { Stroke: ['Freestyle', 'Breaststroke', 'Backstroke', 'Butterfly'] } },
  { name: 'Rowing', category: 'Activity & Conditioning', variations: { Type: ['Easy', 'Intervals'], Setting: ['Machine', 'On water'] } },
  { name: 'Walking', category: 'Activity & Conditioning', variations: { Setting: ['Treadmill', 'Outdoor', 'Incline'], Load: ['Rucking'] } },
  { name: 'Hiking', category: 'Activity & Conditioning', variations: {} },
  { name: 'Elliptical', category: 'Activity & Conditioning', variations: {} },
  { name: 'Stair Climber', category: 'Activity & Conditioning', variations: {} },
  { name: 'Jump Rope', category: 'Activity & Conditioning', variations: { Style: ['Double unders', 'Single leg'] } },
  { name: 'Ski Erg', category: 'Activity & Conditioning', variations: {} },
  { name: 'Assault Bike', category: 'Activity & Conditioning', variations: {} },
  { name: 'Yoga', category: 'Activity & Conditioning', variations: { Style: ['Vinyasa', 'Hatha', 'Yin', 'Power'] } },
  { name: 'Mobility', category: 'Activity & Conditioning', variations: { Focus: ['Hips', 'Shoulders', 'Spine', 'Full body'] } },
  { name: 'Sports', category: 'Activity & Conditioning', variations: { Sport: ['Football', 'Basketball', 'Tennis', 'Padel', 'Climbing', 'Martial arts'] } }
];
