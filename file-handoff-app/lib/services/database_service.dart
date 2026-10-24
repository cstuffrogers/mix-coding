import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../models/department.dart';
import '../models/person.dart';
import '../models/tracked_file.dart';

/// 浏览器不支持 sqflite，整库以一段 JSON 字符串存进 SharedPreferences。
class DatabaseService {
  static final DatabaseService _instance = DatabaseService._internal();
  factory DatabaseService() => _instance;
  DatabaseService._internal();

  static const _key = 'handoff_data_v2';

  Future<Map<String, dynamic>> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return {'departments': [], 'persons': [], 'files': []};
    return jsonDecode(raw) as Map<String, dynamic>;
  }

  Future<void> _save(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(data));
  }

  List<Map<String, dynamic>> _list(Map<String, dynamic> data, String key) {
    final raw = data[key] as List<dynamic>? ?? [];
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  void _upsert(List<Map<String, dynamic>> list, Map<String, dynamic> item) {
    final index = list.indexWhere((e) => e['id'] == item['id']);
    if (index == -1) {
      list.add(item);
    } else {
      list[index] = item;
    }
  }

  // ---- Departments ----
  Future<List<Department>> getDepartments() async {
    final data = await _load();
    return _list(data, 'departments').map(Department.fromJson).toList();
  }

  Future<void> saveDepartment(Department dept) async {
    final data = await _load();
    final list = _list(data, 'departments');
    _upsert(list, dept.toJson());
    data['departments'] = list;
    await _save(data);
  }

  Future<void> deleteDepartment(String id) async {
    final data = await _load();
    data['departments'] = _list(
      data,
      'departments',
    ).where((e) => e['id'] != id).toList();
    await _save(data);
  }

  // ---- Persons ----
  Future<List<Person>> getPersons() async {
    final data = await _load();
    return _list(data, 'persons').map(Person.fromJson).toList();
  }

  Future<void> savePerson(Person person) async {
    final data = await _load();
    final list = _list(data, 'persons');
    _upsert(list, person.toJson());
    data['persons'] = list;
    await _save(data);
  }

  Future<void> deletePerson(String id) async {
    final data = await _load();
    data['persons'] = _list(
      data,
      'persons',
    ).where((e) => e['id'] != id).toList();
    await _save(data);
  }

  // ---- Tracked files ----
  Future<List<TrackedFile>> getTrackedFiles() async {
    final data = await _load();
    final files = _list(data, 'files').map(TrackedFile.fromJson).toList()
      ..sort((a, b) => b.registeredAt.compareTo(a.registeredAt));
    return files;
  }

  Future<TrackedFile?> getFileById(String id) async {
    final files = await getTrackedFiles();
    for (final file in files) {
      if (file.id == id) return file;
    }
    return null;
  }

  Future<void> saveFile(TrackedFile file) async {
    final data = await _load();
    final list = _list(data, 'files');
    _upsert(list, file.toJson());
    data['files'] = list;
    await _save(data);
  }

  Future<void> saveFiles(List<TrackedFile> files) async {
    if (files.isEmpty) return;
    final data = await _load();
    final list = _list(data, 'files');
    for (final file in files) {
      _upsert(list, file.toJson());
    }
    data['files'] = list;
    await _save(data);
  }

  Future<void> deleteFile(String id) async {
    final data = await _load();
    data['files'] = _list(data, 'files').where((e) => e['id'] != id).toList();
    await _save(data);
  }

  // ---- 当日流水号：YYYYMMDD-NN号文 ----
  Future<String> generateNumber(DateTime date) async {
    final key =
        '${date.year}${date.month.toString().padLeft(2, '0')}${date.day.toString().padLeft(2, '0')}';
    var max = 0;
    final data = await _load();
    for (final item in _list(data, 'files')) {
      final match = RegExp(
        '^$key-(\\d+)',
      ).firstMatch(item['number'] as String? ?? '');
      final seq = int.tryParse(match?.group(1) ?? '') ?? 0;
      if (seq > max) max = seq;
    }
    final next = max + 1;
    return '$key-${next.toString().padLeft(2, '0')}号文';
  }
}
