/**
 * @module ados-sdk-completions
 * @description Monaco editor completion provider for the ADOS Python SDK.
 * @license GPL-3.0-only
 */

import type { languages } from "monaco-editor";

interface SdkMethod {
  label: string;
  insertText: string;
  detail: string;
  documentation: string;
}

const SDK_METHODS: SdkMethod[] = [
  { label: "drone.arm", insertText: "await drone.arm()", detail: "() -> None", documentation: "Arm the vehicle motors. Requires GPS lock and pre-arm checks passing." },
  { label: "drone.disarm", insertText: "await drone.disarm()", detail: "() -> None", documentation: "Disarm the vehicle motors." },
  { label: "drone.takeoff", insertText: "await drone.takeoff(${1:alt})", detail: "(alt: float) -> None", documentation: "Take off to the specified altitude in meters." },
  { label: "drone.land", insertText: "await drone.land()", detail: "() -> None", documentation: "Land at the current position." },
  { label: "drone.goto", insertText: "await drone.goto(${1:lat}, ${2:lon}, ${3:alt})", detail: "(lat: float, lon: float, alt: float) -> None", documentation: "Fly to a GPS coordinate at the given altitude." },
  { label: "drone.rtl", insertText: "await drone.rtl()", detail: "() -> None", documentation: "Return to launch position and land." },
  { label: "drone.set_mode", insertText: "await drone.set_mode(${1:'LOITER'})", detail: "(mode: str) -> None", documentation: "Change the flight mode (STABILIZE, LOITER, AUTO, GUIDED, RTL, LAND)." },
  { label: "drone.hover", insertText: "await drone.hover(${1:seconds})", detail: "(seconds: float) -> None", documentation: "Hover in place for the specified duration." },
  { label: "drone.get_param", insertText: "await drone.get_param(${1:'PARAM_NAME'})", detail: "(name: str) -> float", documentation: "Read a flight controller parameter value." },
  { label: "drone.set_param", insertText: "await drone.set_param(${1:'PARAM_NAME'}, ${2:value})", detail: "(name: str, value: float) -> None", documentation: "Write a flight controller parameter value." },
  { label: "drone.armed", insertText: "drone.armed", detail: "bool", documentation: "Whether the vehicle is currently armed." },
  { label: "drone.mode", insertText: "drone.mode", detail: "str", documentation: "Current flight mode string." },
  { label: "drone.battery_percent", insertText: "drone.battery_percent", detail: "float", documentation: "Battery remaining percentage (0-100)." },
  { label: "drone.altitude", insertText: "drone.altitude", detail: "float", documentation: "Current altitude in meters AGL." },
  { label: "drone.groundspeed", insertText: "drone.groundspeed", detail: "float", documentation: "Current ground speed in m/s." },
  { label: "drone.position", insertText: "drone.position", detail: "(float, float, float)", documentation: "Current (lat, lon, alt) tuple." },
  { label: "drone.heading", insertText: "drone.heading", detail: "float", documentation: "Current heading in degrees (0-360)." },
  { label: "drone.load_mission", insertText: "drone.load_mission(${1:'mission_name'})", detail: "(name: str) -> Mission", documentation: "Load a named mission from the mission library." },
  { label: "drone.execute_mission", insertText: "await drone.execute_mission(${1:mission})", detail: "(mission: Mission) -> None", documentation: "Execute a loaded mission plan." },
  { label: "sensors.check_all", insertText: "await sensors.check_all()", detail: "() -> dict[str, SensorResult]", documentation: "Run health checks on all connected sensors." },
  { label: "camera.start_capture", insertText: "await camera.start_capture(interval_m=${1:10})", detail: "(interval_m: float) -> None", documentation: "Start automatic photo capture at a distance interval." },
  { label: "camera.stop_capture", insertText: "await camera.stop_capture()", detail: "() -> None", documentation: "Stop automatic photo capture." },
  { label: "camera.photo_count", insertText: "camera.photo_count", detail: "int", documentation: "Number of photos captured in the current session." },
];

export function createAdosSdkCompletionProvider(): languages.CompletionItemProvider {
  return {
    triggerCharacters: ["."],
    provideCompletionItems(model, position) {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const lineContent = model.getLineContent(position.lineNumber);
      const textBefore = lineContent.substring(0, position.column - 1);

      const suggestions: languages.CompletionItem[] = SDK_METHODS
        .filter((m) => {
          if (textBefore.endsWith("drone.")) return m.label.startsWith("drone.");
          if (textBefore.endsWith("sensors.")) return m.label.startsWith("sensors.");
          if (textBefore.endsWith("camera.")) return m.label.startsWith("camera.");
          return true;
        })
        .map((m, i) => ({
          label: m.label,
          kind: m.insertText.includes("(") ? 1 : 5, // Function or Field
          insertText: m.insertText,
          insertTextRules: m.insertText.includes("${") ? 4 : 0, // InsertAsSnippet if has placeholders
          detail: m.detail,
          documentation: m.documentation,
          range,
          sortText: String(i).padStart(3, "0"),
        }));

      return { suggestions };
    },
  };
}
