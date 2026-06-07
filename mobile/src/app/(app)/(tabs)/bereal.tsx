import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import {
  disableBeReal,
  enableBeReal,
  getBeRealStatus,
  listBeRealMoments,
  mediaUrl,
  postBeRealPhoto,
  type BeRealMoment,
  type BeRealStatus,
  type UploadFile,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { deviceTimezone, relativeTime, shortDate, shortTime } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Body, Button, Card, H1, H2, Muted, Screen } from "@/theme/ui";
import { colors, radius } from "@/theme/tokens";

function MomentCard({ moment }: { moment: BeRealMoment }) {
  return (
    <Card>
      <H2>{shortDate(moment.scheduled_utc)}</H2>
      <Muted>
        {shortTime(moment.scheduled_utc)} · {moment.status}
      </Muted>
      {moment.posts.length > 0 ? (
        <View style={styles.photos}>
          {moment.posts.map((p) => (
            <Image
              key={p.id}
              source={{ uri: mediaUrl(p.image_url) }}
              style={styles.photo}
              contentFit="cover"
              transition={200}
            />
          ))}
        </View>
      ) : (
        <Muted>No photos shared for this moment.</Muted>
      )}
    </Card>
  );
}

export default function BeRealScreen() {
  const { token } = useAuth();
  const [status, setStatus] = useState<BeRealStatus | null>(null);
  const [history, setHistory] = useState<BeRealMoment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [s, list] = await Promise.all([getBeRealStatus(token), listBeRealMoments(token, 20, 0)]);
      setStatus(s);
      setHistory(list.moments);
    } catch {
      /* surfaced via empty UI */
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function toggle() {
    if (!token || !status) return;
    setBusy(true);
    try {
      const next = status.is_active
        ? await disableBeReal(token)
        : await enableBeReal(token, deviceTimezone());
      setStatus(next);
    } catch {
      Alert.alert("BeReal", "Couldn't update BeReal. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function postPhoto() {
    if (!token || !status?.current_moment) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera access needed", "Enable camera access in Settings to share your moment.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, cameraType: ImagePicker.CameraType.front });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const file: UploadFile = {
      uri: asset.uri,
      name: asset.fileName ?? "bereal.jpg",
      type: asset.mimeType ?? "image/jpeg",
    };
    setBusy(true);
    try {
      await postBeRealPhoto(token, status.current_moment.id, file);
      await load();
    } catch {
      Alert.alert("BeReal", "Couldn't upload your photo. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const moment = status?.current_moment;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.dawn} />
      }
    >
      <H1 highlight="moment">Your daily</H1>
      <Muted>A surprise time each day to snap where you are — together, apart.</Muted>

      <Card>
        <H2>{status?.is_active ? "BeReal is on" : "BeReal is off"}</H2>
        {status?.is_active ? (
          <Muted>
            {status.next_utc
              ? `Next moment around ${shortTime(status.next_utc)} ${shortDate(status.next_utc)}.`
              : "We'll surprise you with a moment soon."}
          </Muted>
        ) : (
          <Muted>Turn it on to get a daily prompt to share a candid photo.</Muted>
        )}

        {status?.partners && status.partners.length > 0 && (
          <View style={{ gap: 2 }}>
            {status.partners.map((p) => (
              <Muted key={p.user_id}>
                {p.display_name}: {p.local_time ? shortTime(p.local_time) : p.timezone}
              </Muted>
            ))}
          </View>
        )}

        <Button
          title={status?.is_active ? "Turn off BeReal" : "Turn on BeReal"}
          variant={status?.is_active ? "ghost" : "primary"}
          onPress={toggle}
          loading={busy}
          disabled={busy || !status}
        />
      </Card>

      {moment && moment.is_open && !moment.you_posted && (
        <Card>
          <H2>It&apos;s time! 📸</H2>
          <Muted>Your moment is open. Snap a quick photo to share with your partner.</Muted>
          <Button title="Take photo" onPress={postPhoto} loading={busy} disabled={busy} />
        </Card>
      )}

      {moment && moment.you_posted && (
        <Card>
          <H2>Shared ✅</H2>
          <Muted>
            {moment.partner_posted
              ? "You both shared this moment."
              : "Waiting for your partner to share theirs."}
          </Muted>
        </Card>
      )}

      <H2>History</H2>
      {history.length === 0 ? (
        <EmptyState icon="🤳" title="No moments yet">
          Once BeReal is on, your shared moments will appear here.
        </EmptyState>
      ) : (
        history.map((m) => <MomentCard key={m.id} moment={m} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photo: {
    width: 150,
    height: 150,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSoft,
  },
});
