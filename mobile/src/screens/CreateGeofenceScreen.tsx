/**
 * Create Geofence Screen
 * Privacy-first geofence creation with map interface
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle } from 'react-native-maps';
import { locationService, LocationUsageReason } from '../services/locationService';
import { useGeofences } from '../hooks/useGeofences';

interface CreateGeofenceScreenProps {
  navigation: any;
}

export default function CreateGeofenceScreen({ navigation }: CreateGeofenceScreenProps) {
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'home' | 'work' | 'gym' | 'store' | 'custom'>('custom');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [radius, setRadius] = useState(200); // Default 200m
  const [notifyOnEnter, setNotifyOnEnter] = useState(true);
  const [notifyOnExit, setNotifyOnExit] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const { createGeofence } = useGeofences();

  /**
   * Request location permission and get current location
   */
  const requestLocationAccess = async () => {
    setLocationLoading(true);

    try {
      // Show explanation first
      const reason: LocationUsageReason = {
        action: 'create_geofence',
        description: locationService.getPermissionExplanation('create_geofence'),
        requiresBackground: false,
      };

      Alert.alert(
        'Location Permission',
        reason.description,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => setLocationLoading(false),
          },
          {
            text: 'Allow',
            onPress: async () => {
              const granted = await locationService.requestForegroundPermission(reason);

              if (granted) {
                const currentLocation = await locationService.getCurrentLocation();
                if (currentLocation) {
                  setLocation({
                    latitude: currentLocation.coords.latitude,
                    longitude: currentLocation.coords.longitude,
                  });
                  console.log('[CreateGeofence] Location obtained');
                } else {
                  Alert.alert('Error', 'Could not get your location');
                }
              } else {
                Alert.alert(
                  'Permission Denied',
                  'Location permission is required to create geofences. You can enable it in Settings.'
                );
              }
              setLocationLoading(false);
            },
          },
        ]
      );
    } catch (error) {
      console.error('[CreateGeofence] Error requesting location:', error);
      Alert.alert('Error', 'Failed to get location');
      setLocationLoading(false);
    }
  };

  /**
   * Handle map press to set geofence location
   */
  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
    console.log('[CreateGeofence] Location set via map:', latitude, longitude);
  };

  /**
   * Validate and create geofence
   */
  const handleCreate = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for this geofence');
      return;
    }

    if (!location) {
      Alert.alert('Validation Error', 'Please set a location for this geofence');
      return;
    }

    if (radius < 50 || radius > 5000) {
      Alert.alert('Validation Error', 'Radius must be between 50m and 5km');
      return;
    }

    setLoading(true);

    try {
      // Explain background permission if notifications enabled
      if (notifyOnEnter || notifyOnExit) {
        await explainBackgroundPermission();
      }

      const geofence = await createGeofence({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        location,
        radius,
        notifyOnEnter,
        notifyOnExit,
      });

      if (geofence) {
        Alert.alert(
          'Geofence Created',
          `"${geofence.name}" has been created successfully.`,
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to create geofence');
      }
    } catch (error: any) {
      console.error('[CreateGeofence] Error creating:', error);
      Alert.alert('Error', error.message || 'Failed to create geofence');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Explain background permission requirement
   */
  const explainBackgroundPermission = async () => {
    return new Promise<void>((resolve) => {
      Alert.alert(
        'Background Location Access',
        locationService.getBackgroundPermissionExplanation(),
        [
          {
            text: 'No Thanks',
            style: 'cancel',
            onPress: () => {
              setNotifyOnEnter(false);
              setNotifyOnExit(false);
              resolve();
            },
          },
          {
            text: 'Enable Notifications',
            onPress: async () => {
              const granted = await locationService.requestBackgroundPermission();
              if (!granted) {
                Alert.alert(
                  'Permission Required',
                  'Background location is required for geofence notifications. You can enable it in Settings.',
                  [{ text: 'OK', onPress: () => resolve() }]
                );
              } else {
                resolve();
              }
            },
          },
        ]
      );
    });
  };

  // Request location on mount
  useEffect(() => {
    requestLocationAccess();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Create Geofence</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      {/* Privacy Notice */}
      <View style={styles.privacyNotice}>
        <Text style={styles.privacyText}>
          🔒 Your location is only used to set this geofence. We don't track your movements.
        </Text>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        {location ? (
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            onPress={handleMapPress}
          >
            <Marker coordinate={location} title="Geofence Center" />
            <Circle
              center={location}
              radius={radius}
              fillColor="rgba(79, 70, 229, 0.2)"
              strokeColor="rgba(79, 70, 229, 0.8)"
              strokeWidth={2}
            />
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            {locationLoading ? (
              <ActivityIndicator size="large" color="#4F46E5" />
            ) : (
              <TouchableOpacity onPress={requestLocationAccess} style={styles.locationButton}>
                <Text style={styles.locationButtonText}>📍 Enable Location</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Form */}
      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g., Home, Office, Gym"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What should you remember here?"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
          />
        </View>

        {/* Type */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Type</Text>
          <View style={styles.typeButtons}>
            {(['home', 'work', 'gym', 'store', 'custom'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeButton, type === t && styles.typeButtonActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.typeButtonText, type === t && styles.typeButtonTextActive]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Radius */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Radius: {radius}m</Text>
          <View style={styles.radiusButtons}>
            {[50, 100, 200, 500, 1000].map((r) => (
              <TouchableOpacity
                key={r}
                style={[styles.radiusButton, radius === r && styles.radiusButtonActive]}
                onPress={() => setRadius(r)}
              >
                <Text style={[styles.radiusButtonText, radius === r && styles.radiusButtonTextActive]}>
                  {r}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.formGroup}>
          <Text style={styles.label}>Notifications</Text>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.switchText}>Notify on entry</Text>
              <Text style={styles.switchSubtext}>Alert when you arrive</Text>
            </View>
            <Switch value={notifyOnEnter} onValueChange={setNotifyOnEnter} />
          </View>

          <View style={styles.switchRow}>
            <View style={styles.switchLabel}>
              <Text style={styles.switchText}>Notify on exit</Text>
              <Text style={styles.switchSubtext}>Alert when you leave</Text>
            </View>
            <Switch value={notifyOnExit} onValueChange={setNotifyOnExit} />
          </View>

          {(notifyOnEnter || notifyOnExit) && (
            <Text style={styles.permissionNote}>
              📱 Background location permission will be requested to enable notifications
            </Text>
          )}
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.createButtonText}>Create Geofence</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  privacyNotice: {
    backgroundColor: '#EFF6FF',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#DBEAFE',
  },
  privacyText: {
    fontSize: 13,
    color: '#3B82F6',
    textAlign: 'center',
    lineHeight: 18,
  },
  mapContainer: {
    height: 250,
    backgroundColor: '#E5E7EB',
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  locationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typeButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  radiusButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radiusButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  radiusButtonActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  radiusButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  radiusButtonTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  switchLabel: {
    flex: 1,
  },
  switchText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '600',
  },
  switchSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  permissionNote: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 10,
    lineHeight: 18,
  },
  createButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 32,
  },
  createButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
