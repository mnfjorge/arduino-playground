import { getConnectionStableId } from "@/lib/diagram/connection-id";
import type { DiagramConnection } from "@/lib/diagram/types";

describe("getConnectionStableId", () => {
  it("uses connection.id when present", () => {
    const connection: DiagramConnection = {
      id: "wire-1",
      from: { component: "a", pin: "D1" },
      to: { component: "b", pin: "IN" },
    };
    expect(getConnectionStableId(connection)).toBe("wire-1");
  });

  it("is stable regardless of from/to order in data", () => {
    const ab: DiagramConnection = {
      from: { component: "arduino", pin: "D2" },
      to: { component: "led", pin: "anode" },
    };
    const ba: DiagramConnection = {
      from: { component: "led", pin: "anode" },
      to: { component: "arduino", pin: "D2" },
    };
    expect(getConnectionStableId(ab)).toBe(getConnectionStableId(ba));
  });
});
