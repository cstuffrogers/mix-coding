import 'file_status.dart';
import 'handoff.dart';
export 'file_status.dart';
export 'handoff.dart';

class TrackedFile {
  final String id;
  String number;
  String name;
  DateTime registeredAt;
  String? remark;
  final List<Handoff> handoffs;
  bool completed;

  TrackedFile({
    required this.id,
    required this.number,
    required this.name,
    required this.registeredAt,
    this.remark,
    List<Handoff>? handoffs,
    this.completed = false,
  }) : handoffs = handoffs ?? [];

  FileStatus get status {
    if (completed) return FileStatus.completed;
    if (handoffs.isEmpty) return FileStatus.pending;
    return handoffs.last.completedAt == null
        ? FileStatus.processing
        : FileStatus.completed;
  }

  String? get currentHolderId =>
      status == FileStatus.processing ? handoffs.last.toPersonId : null;

  Handoff? get openHandoff =>
      handoffs.isNotEmpty && handoffs.last.completedAt == null
      ? handoffs.last
      : null;

  Map<String, dynamic> toJson() => {
    'id': id,
    'number': number,
    'name': name,
    'registeredAt': registeredAt.toIso8601String(),
    'remark': remark,
    'handoffs': handoffs.map((h) => h.toJson()).toList(),
    'completed': completed,
  };

  factory TrackedFile.fromJson(Map<String, dynamic> j) => TrackedFile(
    id: j['id'] as String,
    number: j['number'] as String,
    name: j['name'] as String,
    registeredAt: DateTime.parse(j['registeredAt'] as String),
    remark: j['remark'] as String?,
    completed: j['completed'] as bool? ?? false,
    handoffs: (j['handoffs'] as List)
        .map((e) => Handoff.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList(),
  );
}
