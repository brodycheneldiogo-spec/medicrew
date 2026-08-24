import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { usePreferences } from "../lib/preferences-context";
import { localize } from "../lib/i18n";
import { UserSafetyActions } from "../lib/user-safety-actions";
type Message = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};
export default function DirectChat() {
  const prefs = usePreferences();
  const L = (en: string, fr: string, es: string) =>
    localize(prefs.language, en, fr, es);
  const { conversationId, title } = useLocalSearchParams<{
    conversationId?: string;
    title?: string;
  }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [myId, setMyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [otherId, setOtherId] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    let channel: any;
    (async () => {
      if (!supabase || !conversationId) {
        setLoading(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      setMyId(user.id);
      const { data: context, error: contextError } = await supabase.rpc(
        "direct_conversation_context",
        { p_conversation_id: conversationId },
      );
      if (contextError) {
        setError(contextError.message);
        setLoading(false);
        return;
      }
      setOtherId(context?.other_profile_id || "");
      setBlocked(Boolean(context?.blocked_either_way));
      const { data, error: e } = await supabase
        .from("direct_messages")
        .select("id,sender_id,body,created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (e) setError(e.message);
      else setMessages((data || []) as Message[]);
      await supabase.rpc("mark_direct_conversation_read", {
        p_conversation_id: conversationId,
      });
      channel = supabase
        .channel(`direct-${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "direct_messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) =>
            setMessages((v) =>
              v.some((x) => x.id === payload.new.id)
                ? v
                : [...v, payload.new as Message],
            ),
        )
        .subscribe();
      setLoading(false);
    })();
    return () => {
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [conversationId]);
  async function send() {
    if (!supabase || !conversationId || !text.trim() || sending) return;
    const body = text.trim();
    setText("");
    setSending(true);
    const { error: e } = await supabase.rpc("send_direct_message", {
      p_conversation_id: conversationId,
      p_body: body,
    });
    if (e) {
      setText(body);
      setError(e.message);
    }
    setSending(false);
  }
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={s.back}>‹</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>
              {title || L("Conversation", "Conversation", "Conversación")}
            </Text>
            <Text style={s.sub}>
              {L(
                "MediCrew direct message",
                "Message direct MediCrew",
                "Mensaje directo MediCrew",
              )}
            </Text>
          </View>
        </View>
        {otherId ? (
          <View style={s.safety}>
            <UserSafetyActions
              targetId={otherId}
              conversationId={String(conversationId)}
              onBlocked={() => setBlocked(true)}
            />
          </View>
        ) : null}
        {blocked ? (
          <Text style={s.blocked}>
            {L(
              "Messaging is disabled because one of you blocked the other.",
              "La messagerie est désactivée car l’un de vous a bloqué l’autre.",
              "La mensajería está desactivada porque uno ha bloqueado al otro.",
            )}
          </Text>
        ) : null}
        {error ? <Text style={s.error}>{error}</Text> : null}
        <ScrollView
          contentContainerStyle={s.list}
          ref={(r) => r?.scrollToEnd({ animated: false })}
        >
          {loading ? (
            <ActivityIndicator color={colors.green} />
          ) : messages.length === 0 ? (
            <Text style={s.empty}>
              {L(
                "No messages yet.",
                "Aucun message pour le moment.",
                "Aún no hay mensajes.",
              )}
            </Text>
          ) : (
            messages.map((m) => (
              <View
                key={m.id}
                style={[s.line, m.sender_id === myId && s.mineLine]}
              >
                <View style={[s.bubble, m.sender_id === myId && s.mine]}>
                  <Text style={[s.body, m.sender_id === myId && s.mineBody]}>
                    {m.body}
                  </Text>
                  <Text style={[s.time, m.sender_id === myId && s.mineTime]}>
                    {new Date(m.created_at).toLocaleTimeString(prefs.language, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        {!blocked ? (
          <View style={s.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              multiline
              maxLength={4000}
              placeholder={L(
                "Write a message…",
                "Écrire un message…",
                "Escribe un mensaje…",
              )}
              style={s.input}
            />
            <Pressable
              disabled={!text.trim() || sending}
              onPress={send}
              style={[s.send, (!text.trim() || sending) && { opacity: 0.35 }]}
            >
              <Text style={s.sendText}>↑</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  back: { fontSize: 28, fontWeight: "700", color: colors.ink },
  title: { fontSize: 15, fontWeight: "900", color: colors.ink },
  sub: { fontSize: 9.5, color: colors.muted, marginTop: 2 },
  list: {
    padding: 15,
    paddingBottom: 20,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  line: { flexDirection: "row", marginVertical: 4 },
  mineLine: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "82%",
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
  },
  mine: { backgroundColor: colors.ink, borderColor: colors.ink },
  body: { fontSize: 14, lineHeight: 20, color: colors.ink },
  mineBody: { color: colors.white },
  time: { fontSize: 8.5, color: colors.muted, marginTop: 4 },
  mineTime: { color: "#BDC3C0", textAlign: "right" },
  empty: {
    textAlign: "center",
    fontSize: 12,
    color: colors.muted,
    padding: 30,
  },
  composer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 10,
    backgroundColor: colors.paper,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { fontSize: 20, fontWeight: "900", color: colors.green },
  error: {
    margin: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FDECEC",
    color: colors.danger,
    fontSize: 11,
  },
  safety: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    backgroundColor: colors.white,
  },
  blocked: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 11,
    borderRadius: 12,
    backgroundColor: "#FFF1F1",
    color: colors.danger,
    fontSize: 11,
    textAlign: "center",
  },
});
