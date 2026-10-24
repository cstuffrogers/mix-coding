class Handoff {
  final String id;
  final String fromPersonId;
  final String toPersonId;
  final DateTime assignedAt;
  DateTime? completedAt;
  final String? remark;

  Handoff({
    required this.id,
    required this.fromPersonId,
    required this.toPersonId,
    required this.assignedAt,
    this.completedAt,
    this.remark,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'fromPersonId': fromPersonId,
        'toPersonId': toPersonId,
        'assignedAt': assignedAt.toIso8601String(),
        'completedAt': completedAt?.toIso8601String(),
        'remark': remark,
      };

  factory Handoff.fromJson(Map<String, dynamic> j) => Handoff(
        id: j['id'] as String,
        fromPersonId: j['fromPersonId'] as String,
        toPersonId: j['toPersonId'] as String,
        assignedAt: DateTime.parse(j['assignedAt'] as String),
        completedAt: j['completedAt'] == null
            ? null
            : DateTime.parse(j['completedAt'] as String),
        remark: j['remark'] as String?,
      );
}