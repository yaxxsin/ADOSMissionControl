/**
 * Default ArduCopter parameters for demo mode.
 *
 * ~200 realistic parameters covering all Configure tab panels:
 * Parameters, Outputs, Receiver, Flight Modes, Failsafe, Power,
 * Calibration, PID Tuning, Ports.
 *
 * All type: 9 (MAV_PARAM_TYPE_REAL32).
 *
 * @license GPL-3.0-only
 */

export interface MockParam {
  name: string;
  value: number;
  type: number;
}

export const MOCK_PARAMS: MockParam[] = [
  // ── PID: Roll / Pitch / Yaw ──────────────────────────
  { name: "ATC_RAT_RLL_P", value: 0.135, type: 9 },
  { name: "ATC_RAT_RLL_I", value: 0.135, type: 9 },
  { name: "ATC_RAT_RLL_D", value: 0.0036, type: 9 },
  { name: "ATC_RAT_RLL_FF", value: 0, type: 9 },
  { name: "ATC_RAT_PIT_P", value: 0.135, type: 9 },
  { name: "ATC_RAT_PIT_I", value: 0.135, type: 9 },
  { name: "ATC_RAT_PIT_D", value: 0.0036, type: 9 },
  { name: "ATC_RAT_PIT_FF", value: 0, type: 9 },
  { name: "ATC_RAT_YAW_P", value: 0.18, type: 9 },
  { name: "ATC_RAT_YAW_I", value: 0.018, type: 9 },
  { name: "ATC_RAT_YAW_D", value: 0, type: 9 },
  { name: "ATC_RAT_YAW_FF", value: 0, type: 9 },
  { name: "ATC_ANG_RLL_P", value: 4.5, type: 9 },
  { name: "ATC_ANG_PIT_P", value: 4.5, type: 9 },
  { name: "ATC_ANG_YAW_P", value: 4.5, type: 9 },

  // ── RC Channels ──────────────────────────────────────
  { name: "RC1_MIN", value: 1100, type: 9 },
  { name: "RC1_MAX", value: 1900, type: 9 },
  { name: "RC1_TRIM", value: 1500, type: 9 },
  { name: "RC1_REVERSED", value: 0, type: 9 },
  { name: "RC2_MIN", value: 1100, type: 9 },
  { name: "RC2_MAX", value: 1900, type: 9 },
  { name: "RC2_TRIM", value: 1500, type: 9 },
  { name: "RC2_REVERSED", value: 0, type: 9 },
  { name: "RC3_MIN", value: 1100, type: 9 },
  { name: "RC3_MAX", value: 1900, type: 9 },
  { name: "RC3_TRIM", value: 1100, type: 9 },
  { name: "RC3_REVERSED", value: 0, type: 9 },
  { name: "RC4_MIN", value: 1100, type: 9 },
  { name: "RC4_MAX", value: 1900, type: 9 },
  { name: "RC4_TRIM", value: 1500, type: 9 },
  { name: "RC4_REVERSED", value: 0, type: 9 },
  { name: "RC5_MIN", value: 1100, type: 9 },
  { name: "RC5_MAX", value: 1900, type: 9 },
  { name: "RC5_TRIM", value: 1500, type: 9 },
  { name: "RC5_REVERSED", value: 0, type: 9 },
  { name: "RC6_MIN", value: 1100, type: 9 },
  { name: "RC6_MAX", value: 1900, type: 9 },
  { name: "RC6_TRIM", value: 1500, type: 9 },
  { name: "RC6_REVERSED", value: 0, type: 9 },
  { name: "RC7_MIN", value: 1100, type: 9 },
  { name: "RC7_MAX", value: 1900, type: 9 },
  { name: "RC7_TRIM", value: 1500, type: 9 },
  { name: "RC7_REVERSED", value: 0, type: 9 },
  { name: "RC8_MIN", value: 1100, type: 9 },
  { name: "RC8_MAX", value: 1900, type: 9 },
  { name: "RC8_TRIM", value: 1500, type: 9 },
  { name: "RC8_REVERSED", value: 0, type: 9 },

  // ── RC Channels 9-16 ──────────────────────────────────────
  { name: "RC9_MIN", value: 1100, type: 9 },
  { name: "RC9_MAX", value: 1900, type: 9 },
  { name: "RC9_TRIM", value: 1500, type: 9 },
  { name: "RC9_REVERSED", value: 0, type: 9 },
  { name: "RC10_MIN", value: 1100, type: 9 },
  { name: "RC10_MAX", value: 1900, type: 9 },
  { name: "RC10_TRIM", value: 1500, type: 9 },
  { name: "RC10_REVERSED", value: 0, type: 9 },
  { name: "RC11_MIN", value: 1100, type: 9 },
  { name: "RC11_MAX", value: 1900, type: 9 },
  { name: "RC11_TRIM", value: 1500, type: 9 },
  { name: "RC11_REVERSED", value: 0, type: 9 },
  { name: "RC12_MIN", value: 1100, type: 9 },
  { name: "RC12_MAX", value: 1900, type: 9 },
  { name: "RC12_TRIM", value: 1500, type: 9 },
  { name: "RC12_REVERSED", value: 0, type: 9 },
  { name: "RC13_MIN", value: 1100, type: 9 },
  { name: "RC13_MAX", value: 1900, type: 9 },
  { name: "RC13_TRIM", value: 1500, type: 9 },
  { name: "RC13_REVERSED", value: 0, type: 9 },
  { name: "RC14_MIN", value: 1100, type: 9 },
  { name: "RC14_MAX", value: 1900, type: 9 },
  { name: "RC14_TRIM", value: 1500, type: 9 },
  { name: "RC14_REVERSED", value: 0, type: 9 },
  { name: "RC15_MIN", value: 1100, type: 9 },
  { name: "RC15_MAX", value: 1900, type: 9 },
  { name: "RC15_TRIM", value: 1500, type: 9 },
  { name: "RC15_REVERSED", value: 0, type: 9 },
  { name: "RC16_MIN", value: 1100, type: 9 },
  { name: "RC16_MAX", value: 1900, type: 9 },
  { name: "RC16_TRIM", value: 1500, type: 9 },
  { name: "RC16_REVERSED", value: 0, type: 9 },

  // ── RC Channel Mapping ─────────────────────────────────────
  { name: "RC_MAP_ROLL", value: 1, type: 9 },
  { name: "RC_MAP_PITCH", value: 2, type: 9 },
  { name: "RC_MAP_THROTTLE", value: 3, type: 9 },
  { name: "RC_MAP_YAW", value: 4, type: 9 },

  // ── RC Per-Channel Deadzone ────────────────────────────────
  { name: "RC1_DZ", value: 30, type: 9 },
  { name: "RC2_DZ", value: 30, type: 9 },
  { name: "RC3_DZ", value: 30, type: 9 },
  { name: "RC4_DZ", value: 30, type: 9 },
  { name: "RC5_DZ", value: 0, type: 9 },
  { name: "RC6_DZ", value: 0, type: 9 },
  { name: "RC7_DZ", value: 0, type: 9 },
  { name: "RC8_DZ", value: 0, type: 9 },
  { name: "RC9_DZ", value: 0, type: 9 },
  { name: "RC10_DZ", value: 0, type: 9 },
  { name: "RC11_DZ", value: 0, type: 9 },
  { name: "RC12_DZ", value: 0, type: 9 },
  { name: "RC13_DZ", value: 0, type: 9 },
  { name: "RC14_DZ", value: 0, type: 9 },
  { name: "RC15_DZ", value: 0, type: 9 },
  { name: "RC16_DZ", value: 0, type: 9 },

  // ── RC Per-Channel Aux Option ──────────────────────────────
  { name: "RC5_OPTION", value: 0, type: 9 },
  { name: "RC6_OPTION", value: 7, type: 9 },   // Save WP
  { name: "RC7_OPTION", value: 4, type: 9 },   // RTL
  { name: "RC8_OPTION", value: 9, type: 9 },   // Camera Trigger
  { name: "RC9_OPTION", value: 0, type: 9 },
  { name: "RC10_OPTION", value: 0, type: 9 },
  { name: "RC11_OPTION", value: 0, type: 9 },
  { name: "RC12_OPTION", value: 0, type: 9 },
  { name: "RC13_OPTION", value: 0, type: 9 },
  { name: "RC14_OPTION", value: 0, type: 9 },
  { name: "RC15_OPTION", value: 0, type: 9 },
  { name: "RC16_OPTION", value: 0, type: 9 },

  // ── RC Global Settings ─────────────────────────────────────
  { name: "RC_PROTOCOLS", value: 1, type: 9 },
  { name: "RC_OPTIONS", value: 0, type: 9 },
  { name: "RC_FEEL_RP", value: 50, type: 9 },
  { name: "RC_OVERRIDE_TIME", value: 3, type: 9 },
  { name: "RC_SPEED", value: 50, type: 9 },

  // ── Servo Outputs ────────────────────────────────────
  { name: "SERVO1_FUNCTION", value: 33, type: 9 },  // Motor1
  { name: "SERVO1_MIN", value: 1000, type: 9 },
  { name: "SERVO1_MAX", value: 2000, type: 9 },
  { name: "SERVO1_TRIM", value: 1000, type: 9 },
  { name: "SERVO1_REVERSED", value: 0, type: 9 },
  { name: "SERVO2_FUNCTION", value: 34, type: 9 },  // Motor2
  { name: "SERVO2_MIN", value: 1000, type: 9 },
  { name: "SERVO2_MAX", value: 2000, type: 9 },
  { name: "SERVO2_TRIM", value: 1000, type: 9 },
  { name: "SERVO2_REVERSED", value: 0, type: 9 },
  { name: "SERVO3_FUNCTION", value: 35, type: 9 },  // Motor3
  { name: "SERVO3_MIN", value: 1000, type: 9 },
  { name: "SERVO3_MAX", value: 2000, type: 9 },
  { name: "SERVO3_TRIM", value: 1000, type: 9 },
  { name: "SERVO3_REVERSED", value: 0, type: 9 },
  { name: "SERVO4_FUNCTION", value: 36, type: 9 },  // Motor4
  { name: "SERVO4_MIN", value: 1000, type: 9 },
  { name: "SERVO4_MAX", value: 2000, type: 9 },
  { name: "SERVO4_TRIM", value: 1000, type: 9 },
  { name: "SERVO4_REVERSED", value: 0, type: 9 },
  { name: "SERVO5_FUNCTION", value: 0, type: 9 },   // Disabled
  { name: "SERVO5_MIN", value: 1000, type: 9 },
  { name: "SERVO5_MAX", value: 2000, type: 9 },
  { name: "SERVO5_TRIM", value: 1500, type: 9 },
  { name: "SERVO5_REVERSED", value: 0, type: 9 },
  { name: "SERVO6_FUNCTION", value: 0, type: 9 },
  { name: "SERVO6_MIN", value: 1000, type: 9 },
  { name: "SERVO6_MAX", value: 2000, type: 9 },
  { name: "SERVO6_TRIM", value: 1500, type: 9 },
  { name: "SERVO6_REVERSED", value: 0, type: 9 },
  { name: "SERVO7_FUNCTION", value: 0, type: 9 },
  { name: "SERVO7_MIN", value: 1000, type: 9 },
  { name: "SERVO7_MAX", value: 2000, type: 9 },
  { name: "SERVO7_TRIM", value: 1500, type: 9 },
  { name: "SERVO7_REVERSED", value: 0, type: 9 },
  { name: "SERVO8_FUNCTION", value: 0, type: 9 },
  { name: "SERVO8_MIN", value: 1000, type: 9 },
  { name: "SERVO8_MAX", value: 2000, type: 9 },
  { name: "SERVO8_TRIM", value: 1500, type: 9 },
  { name: "SERVO8_REVERSED", value: 0, type: 9 },
  { name: "SERVO9_FUNCTION", value: 0, type: 9 },
  { name: "SERVO9_MIN", value: 1000, type: 9 },
  { name: "SERVO9_MAX", value: 2000, type: 9 },
  { name: "SERVO9_TRIM", value: 1500, type: 9 },
  { name: "SERVO9_REVERSED", value: 0, type: 9 },
  { name: "SERVO10_FUNCTION", value: 0, type: 9 },
  { name: "SERVO10_MIN", value: 1000, type: 9 },
  { name: "SERVO10_MAX", value: 2000, type: 9 },
  { name: "SERVO10_TRIM", value: 1500, type: 9 },
  { name: "SERVO10_REVERSED", value: 0, type: 9 },
  { name: "SERVO11_FUNCTION", value: 0, type: 9 },
  { name: "SERVO11_MIN", value: 1000, type: 9 },
  { name: "SERVO11_MAX", value: 2000, type: 9 },
  { name: "SERVO11_TRIM", value: 1500, type: 9 },
  { name: "SERVO11_REVERSED", value: 0, type: 9 },
  { name: "SERVO12_FUNCTION", value: 0, type: 9 },
  { name: "SERVO12_MIN", value: 1000, type: 9 },
  { name: "SERVO12_MAX", value: 2000, type: 9 },
  { name: "SERVO12_TRIM", value: 1500, type: 9 },
  { name: "SERVO12_REVERSED", value: 0, type: 9 },
  { name: "SERVO13_FUNCTION", value: 0, type: 9 },
  { name: "SERVO13_MIN", value: 1000, type: 9 },
  { name: "SERVO13_MAX", value: 2000, type: 9 },
  { name: "SERVO13_TRIM", value: 1500, type: 9 },
  { name: "SERVO13_REVERSED", value: 0, type: 9 },
  { name: "SERVO14_FUNCTION", value: 0, type: 9 },
  { name: "SERVO14_MIN", value: 1000, type: 9 },
  { name: "SERVO14_MAX", value: 2000, type: 9 },
  { name: "SERVO14_TRIM", value: 1500, type: 9 },
  { name: "SERVO14_REVERSED", value: 0, type: 9 },
  { name: "SERVO15_FUNCTION", value: 0, type: 9 },
  { name: "SERVO15_MIN", value: 1000, type: 9 },
  { name: "SERVO15_MAX", value: 2000, type: 9 },
  { name: "SERVO15_TRIM", value: 1500, type: 9 },
  { name: "SERVO15_REVERSED", value: 0, type: 9 },
  { name: "SERVO16_FUNCTION", value: 0, type: 9 },
  { name: "SERVO16_MIN", value: 1000, type: 9 },
  { name: "SERVO16_MAX", value: 2000, type: 9 },
  { name: "SERVO16_TRIM", value: 1500, type: 9 },
  { name: "SERVO16_REVERSED", value: 0, type: 9 },
  { name: "SERVO_RATE", value: 50, type: 9 },

  // ── Battery / Power ──────────────────────────────────
  { name: "BATT_MONITOR", value: 4, type: 9 },
  { name: "BATT_CAPACITY", value: 5200, type: 9 },
  { name: "BATT_VOLT_PIN", value: 2, type: 9 },
  { name: "BATT_CURR_PIN", value: 3, type: 9 },
  { name: "BATT_VOLT_MULT", value: 10.1, type: 9 },
  { name: "BATT_AMP_PERVLT", value: 17.0, type: 9 },
  { name: "BATT_ARM_VOLT", value: 10.5, type: 9 },
  { name: "BATT_LOW_VOLT", value: 10.5, type: 9 },
  { name: "BATT_CRT_VOLT", value: 9.6, type: 9 },

  // ── Failsafes ────────────────────────────────────────
  { name: "FS_BATT_ENABLE", value: 1, type: 9 },
  { name: "FS_BATT_VOLTAGE", value: 10.5, type: 9 },
  { name: "FS_BATT_MAH", value: 0, type: 9 },
  { name: "FS_THR_ENABLE", value: 1, type: 9 },
  { name: "FS_THR_VALUE", value: 975, type: 9 },
  { name: "FS_GCS_ENABLE", value: 1, type: 9 },
  { name: "FS_EKF_ACTION", value: 1, type: 9 },
  { name: "FS_EKF_THRESH", value: 0.8, type: 9 },
  { name: "FS_CRASH_CHECK", value: 1, type: 9 },
  { name: "FS_OPTIONS", value: 0, type: 9 },

  // ── GPS / EKF / AHRS ────────────────────────────────
  { name: "GPS_TYPE", value: 1, type: 9 },
  { name: "GPS_TYPE2", value: 0, type: 9 },
  { name: "GPS_AUTO_SWITCH", value: 1, type: 9 },
  { name: "GPS_GNSS_MODE", value: 0, type: 9 },
  { name: "EK3_ENABLE", value: 1, type: 9 },
  { name: "EK3_GPS_TYPE", value: 0, type: 9 },
  { name: "EK3_IMU_MASK", value: 3, type: 9 },
  { name: "EK3_SRC1_POSXY", value: 3, type: 9 },
  { name: "EK3_SRC1_POSZ", value: 1, type: 9 },
  { name: "EK3_SRC1_VELXY", value: 3, type: 9 },
  { name: "EK3_SRC1_VELZ", value: 3, type: 9 },
  { name: "AHRS_EKF_TYPE", value: 3, type: 9 },

  // ── Arming / Frame / INS ─────────────────────────────
  { name: "ARMING_CHECK", value: 1, type: 9 },
  { name: "ARMING_RUDDER", value: 2, type: 9 },
  { name: "FRAME_CLASS", value: 1, type: 9 },    // Quad
  { name: "FRAME_TYPE", value: 1, type: 9 },     // X
  { name: "INS_GYRO_FILTER", value: 20, type: 9 },
  { name: "INS_ACCEL_FILTER", value: 20, type: 9 },
  { name: "INS_USE", value: 1, type: 9 },
  { name: "INS_USE2", value: 1, type: 9 },
  { name: "INS_ACC_BODYFIX", value: 2, type: 9 },
  { name: "INS_FAST_SAMPLE", value: 7, type: 9 },
  { name: "INS_LOG_BAT_CNT", value: 1024, type: 9 },
  { name: "INS_LOG_BAT_MASK", value: 1, type: 9 },

  // ── Motor / Navigation / Pilot ───────────────────────
  { name: "MOT_BAT_VOLT_MAX", value: 25.2, type: 9 },
  { name: "MOT_BAT_VOLT_MIN", value: 19.8, type: 9 },
  { name: "MOT_SPIN_ARM", value: 0.1, type: 9 },
  { name: "MOT_SPIN_MIN", value: 0.15, type: 9 },
  { name: "MOT_SPIN_MAX", value: 0.95, type: 9 },
  { name: "MOT_THST_EXPO", value: 0.65, type: 9 },
  { name: "MOT_THST_HOVER", value: 0.35, type: 9 },
  { name: "MOT_PWM_TYPE", value: 0, type: 9 },
  { name: "MOT_PWM_MIN", value: 1000, type: 9 },
  { name: "MOT_PWM_MAX", value: 2000, type: 9 },
  { name: "WPNAV_SPEED", value: 500, type: 9 },
  { name: "WPNAV_SPEED_DN", value: 150, type: 9 },
  { name: "WPNAV_SPEED_UP", value: 250, type: 9 },
  { name: "WPNAV_ACCEL", value: 100, type: 9 },
  { name: "WPNAV_RADIUS", value: 200, type: 9 },
  { name: "PILOT_SPEED_UP", value: 250, type: 9 },
  { name: "PILOT_SPEED_DN", value: 0, type: 9 },
  { name: "PILOT_ACCEL_Z", value: 250, type: 9 },
  { name: "PILOT_THR_FILT", value: 0, type: 9 },
  { name: "PILOT_TKOFF_ALT", value: 0, type: 9 },
  { name: "LOIT_SPEED", value: 500, type: 9 },
  { name: "LOIT_ACC_MAX", value: 250, type: 9 },
  { name: "LOIT_BRK_ACCEL", value: 250, type: 9 },
  { name: "LOIT_BRK_DELAY", value: 1, type: 9 },

  // ── Flight Modes ─────────────────────────────────────
  { name: "FLTMODE1", value: 0, type: 9 },   // STABILIZE
  { name: "FLTMODE2", value: 2, type: 9 },   // ALT_HOLD
  { name: "FLTMODE3", value: 5, type: 9 },   // LOITER
  { name: "FLTMODE4", value: 3, type: 9 },   // AUTO
  { name: "FLTMODE5", value: 6, type: 9 },   // RTL
  { name: "FLTMODE6", value: 9, type: 9 },   // LAND
  { name: "FLTMODE_CH", value: 5, type: 9 },
  { name: "SIMPLE", value: 0, type: 9 },
  { name: "SUPER_SIMPLE", value: 0, type: 9 },
  { name: "INITIAL_MODE", value: 0, type: 9 },

  // ── Stream Rates ─────────────────────────────────────
  { name: "SR0_RAW_SENS", value: 2, type: 9 },
  { name: "SR0_EXT_STAT", value: 2, type: 9 },
  { name: "SR0_RC_CHAN", value: 5, type: 9 },
  { name: "SR0_RAW_CTRL", value: 1, type: 9 },
  { name: "SR0_POSITION", value: 3, type: 9 },
  { name: "SR0_EXTRA1", value: 10, type: 9 },
  { name: "SR0_EXTRA2", value: 10, type: 9 },
  { name: "SR0_EXTRA3", value: 1, type: 9 },
  { name: "SR0_ADSB", value: 5, type: 9 },
  { name: "SR0_PARAMS", value: 10, type: 9 },

  // ── Compass ──────────────────────────────────────────
  { name: "COMPASS_USE", value: 1, type: 9 },
  { name: "COMPASS_USE2", value: 1, type: 9 },
  { name: "COMPASS_AUTODEC", value: 1, type: 9 },
  { name: "COMPASS_DEC", value: 0, type: 9 },
  { name: "COMPASS_MOT_X", value: 0, type: 9 },
  { name: "COMPASS_MOT_Y", value: 0, type: 9 },
  { name: "COMPASS_MOT_Z", value: 0, type: 9 },
  { name: "COMPASS_OFS_X", value: 5, type: 9 },
  { name: "COMPASS_OFS_Y", value: 13, type: 9 },
  { name: "COMPASS_OFS_Z", value: -18, type: 9 },
  { name: "COMPASS_ORIENT", value: 0, type: 9 },
  { name: "COMPASS_EXTERNAL", value: 1, type: 9 },

  // ── System ID ────────────────────────────────────────
  { name: "SYSID_THISMAV", value: 1, type: 9 },
  { name: "SYSID_MYGCS", value: 255, type: 9 },

  // ── Fence ────────────────────────────────────────────
  { name: "FENCE_ENABLE", value: 1, type: 9 },
  { name: "FENCE_TYPE", value: 7, type: 9 },   // ALT_MAX + CIRCLE + POLYGON
  { name: "FENCE_ACTION", value: 1, type: 9 },  // RTL
  { name: "FENCE_ALT_MAX", value: 120, type: 9 },
  { name: "FENCE_RADIUS", value: 300, type: 9 },
  { name: "FENCE_MARGIN", value: 2, type: 9 },

  // ── Logging ──────────────────────────────────────────
  { name: "LOG_BITMASK", value: 176126, type: 9 },
  { name: "LOG_BACKEND_TYPE", value: 1, type: 9 },
  { name: "LOG_DISARMED", value: 0, type: 9 },
  { name: "LOG_REPLAY", value: 0, type: 9 },
  { name: "LOG_FILE_DSRMROT", value: 1, type: 9 },

  // ── Mission / Land / RTL ─────────────────────────────
  { name: "MIS_TOTAL", value: 0, type: 9 },
  { name: "MIS_RESTART", value: 0, type: 9 },
  { name: "MIS_OPTIONS", value: 0, type: 9 },
  { name: "LAND_SPEED", value: 50, type: 9 },
  { name: "LAND_SPEED_HIGH", value: 0, type: 9 },
  { name: "LAND_ALT_LOW", value: 1000, type: 9 },
  { name: "LAND_REPOSITION", value: 1, type: 9 },
  { name: "RTL_ALT", value: 1500, type: 9 },
  { name: "RTL_ALT_FINAL", value: 0, type: 9 },
  { name: "RTL_CLIMB_MIN", value: 0, type: 9 },
  { name: "RTL_LOIT_TIME", value: 5000, type: 9 },
  { name: "RTL_SPEED", value: 0, type: 9 },
  { name: "RTL_CONE_SLOPE", value: 3, type: 9 },

  // ── Serial Ports ─────────────────────────────────────
  { name: "SERIAL0_PROTOCOL", value: 2, type: 9 },   // MAVLink2
  { name: "SERIAL0_BAUD", value: 115, type: 9 },
  { name: "SERIAL1_PROTOCOL", value: 2, type: 9 },
  { name: "SERIAL1_BAUD", value: 57, type: 9 },
  { name: "SERIAL2_PROTOCOL", value: -1, type: 9 },
  { name: "SERIAL2_BAUD", value: 57, type: 9 },
  { name: "SERIAL3_PROTOCOL", value: 5, type: 9 },   // GPS
  { name: "SERIAL3_BAUD", value: 38, type: 9 },
  { name: "SERIAL4_PROTOCOL", value: -1, type: 9 },
  { name: "SERIAL4_BAUD", value: 115, type: 9 },

  // ── OSD ──────────────────────────────────────────────
  { name: "OSD_TYPE", value: 1, type: 9 },
  { name: "OSD1_ALTITUDE", value: 1, type: 9 },
  { name: "OSD1_BATTVOLT", value: 1, type: 9 },
  { name: "OSD1_RSSI", value: 1, type: 9 },
  { name: "OSD1_GPSLAT", value: 1, type: 9 },
  { name: "OSD1_GPSLONG", value: 1, type: 9 },
  { name: "OSD1_GPSHDOP", value: 1, type: 9 },
  { name: "OSD1_SATS", value: 1, type: 9 },
  { name: "OSD1_FLTMODE", value: 1, type: 9 },
  { name: "OSD1_MESSAGE", value: 1, type: 9 },
];
