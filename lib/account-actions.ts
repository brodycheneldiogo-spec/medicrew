import { Alert, Platform } from "react-native";
import { supabase } from "./supabase";
export function confirmAccountDeletion(done: () => void) {
  if (Platform.OS === "web") {
    const confirmed =
      typeof window !== "undefined" &&
      window.confirm(
        "Delete your MediCrew account permanently? This cannot be undone.",
      );
    if (!confirmed) return;
    void (async () => {
      if (!supabase) return;
      const { error } = await supabase.rpc("delete_my_account");
      if (error) return Alert.alert("Could not delete account", error.message);
      await supabase.auth.signOut();
      done();
    })();
    return;
  }
  Alert.alert(
    "Delete account?",
    "This permanently deletes your MediCrew account, profile and associated data. This cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete permanently",
        style: "destructive",
        onPress: async () => {
          if (!supabase) return;
          const { error } = await supabase.rpc("delete_my_account");
          if (error)
            return Alert.alert("Could not delete account", error.message);
          await supabase.auth.signOut();
          done();
        },
      },
    ],
  );
}
