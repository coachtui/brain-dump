import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSearch } from '../hooks/useSearch';
import type { AtomicObject, Category } from '@shared/types';

const CATEGORIES: Category[] = ['Business', 'Personal', 'Fitness', 'Health', 'Family'];

export default function SearchScreen({ navigation }: any) {
  const [query, setQuery] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const { results, loading, error, search } = useSearch();

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        search(query, { category: selectedCategories });
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, selectedCategories]);

  const toggleCategory = (category: Category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const clearSearch = () => {
    setQuery('');
    setSelectedCategories([]);
  };

  const renderResult = ({ item }: { item: AtomicObject & { _searchScore?: number } }) => (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => navigation.navigate('ObjectDetail', { objectId: item.id })}
    >
      <View style={styles.resultHeader}>
        <View style={styles.categoryContainer}>
          {item.category.map((cat) => (
            <View key={cat} style={[styles.categoryChip, getCategoryColor(cat)]}>
              <Text style={styles.categoryText}>{cat}</Text>
            </View>
          ))}
        </View>
        {item._searchScore && (
          <Text style={styles.scoreText}>
            {Math.round(item._searchScore * 100)}% match
          </Text>
        )}
      </View>
      <Text style={styles.resultContent} numberOfLines={3}>
        {item.content}
      </Text>
      <View style={styles.resultFooter}>
        <Text style={styles.timestampText}>
          {new Date(item.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}
        </Text>
        {item.metadata.tags.length > 0 && (
          <View style={styles.tagsContainer}>
            {item.metadata.tags.slice(0, 3).map((tag) => (
              <Text key={tag} style={styles.tagText}>
                #{tag}
              </Text>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.emptyStateText}>Searching...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" />
          <Text style={styles.emptyStateTitle}>Search Failed</Text>
          <Text style={styles.emptyStateText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => query.trim() && search(query, { category: selectedCategories })}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!query.trim()) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyStateTitle}>Search Your Notes</Text>
          <Text style={styles.emptyStateText}>
            Try searching for "workout", "meetings", or "groceries"
          </Text>
        </View>
      );
    }

    if (results.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color="#9CA3AF" />
          <Text style={styles.emptyStateTitle}>No Results Found</Text>
          <Text style={styles.emptyStateText}>
            Try different keywords or remove filters
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Search</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your notes..."
          placeholderTextColor="#9CA3AF"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersContainer}
        contentContainerStyle={styles.filtersContent}
      >
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategories.includes(category);
          return (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                isSelected && styles.filterChipSelected,
                isSelected && getCategoryColor(category),
              ]}
              onPress={() => toggleCategory(category)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isSelected && styles.filterChipTextSelected,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results Count */}
      {results.length > 0 && (
        <View style={styles.resultsCountContainer}>
          <Text style={styles.resultsCountText}>
            {results.length} result{results.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      )}

      {/* Results List */}
      <FlatList
        data={results}
        renderItem={renderResult}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.resultsList}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function getCategoryColor(category: Category) {
  const colors: Record<Category, any> = {
    Business: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' },
    Personal: { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
    Fitness: { backgroundColor: '#D1FAE5', borderColor: '#10B981' },
    Health: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
    Family: { backgroundColor: '#E9D5FF', borderColor: '#A855F7' },
  };
  return colors[category] || { backgroundColor: '#F3F4F6', borderColor: '#9CA3AF' };
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  clearButton: {
    marginLeft: 8,
  },
  filtersContainer: {
    marginTop: 16,
    maxHeight: 50,
  },
  filtersContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterChipSelected: {
    borderWidth: 2,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipTextSelected: {
    fontWeight: '600',
    color: '#111827',
  },
  resultsCountContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resultsCountText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  resultsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
  },
  categoryChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
  },
  resultContent: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  resultFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tagText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
