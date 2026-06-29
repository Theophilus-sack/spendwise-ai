import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { callEdgeFunction } from '@/lib/supabase';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/theme';
import type { ReceiptOCRResult } from '@spendwise/shared';
import type { AppStackNavProp } from '@/navigation/types';

export function ReceiptScannerScreen() {
  const nav  = useNavigation<AppStackNavProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View style={styles.safe} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionEmoji}>📸</Text>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>We need camera access to scan your receipts automatically.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || scanning) return;
    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
      if (!photo?.base64) throw new Error('Failed to capture photo');

      // Send to Edge Function for OCR + structuring
      const result = await callEdgeFunction<ReceiptOCRResult>('ocr-receipt', {
        imageBase64: photo.base64,
      });

      // Navigate to AddExpense with pre-filled data
      nav.replace('AddExpense', {
        prefill: {
          amount:      result.totalAmount,
          merchantName: result.merchantName,
          category:    result.suggestedCategory,
          date:        result.date,
        },
      });
    } catch (err: any) {
      Alert.alert('Scan failed', err.message ?? 'Could not read the receipt. Try again or enter manually.');
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.safe}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        {/* Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanFrame} />
          <Text style={styles.hint}>Position receipt within the frame</Text>
        </View>

        {/* Bottom bar */}
        <View style={styles.bottomBar}>
          <TouchableOpacity onPress={() => nav.goBack()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureBtn} onPress={handleCapture} disabled={scanning}>
            {scanning
              ? <ActivityIndicator color="#fff" />
              : <View style={styles.captureInner} />
            }
          </TouchableOpacity>

          <View style={{ width: 70 }} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  overlay:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg },
  scanFrame: { width: 280, height: 380, borderRadius: Radius.xl, borderWidth: 3, borderColor: Colors.primaryLight, backgroundColor: 'transparent' },
  hint:      { color: '#fff', fontSize: Typography.base, fontWeight: Typography.medium, textShadowColor: '#000', textShadowRadius: 4 },

  bottomBar:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.xl, paddingBottom: 40 },
  cancelBtn:   { width: 70, alignItems: 'center' },
  cancelText:  { color: '#fff', fontSize: Typography.base, fontWeight: Typography.medium },
  captureBtn:  { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff' },
  captureInner:{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
});
