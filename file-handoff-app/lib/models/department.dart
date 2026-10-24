class Department {
  final String id;
  final String name;
  final String? remark;

  Department({
    required this.id,
    required this.name,
    this.remark,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'remark': remark,
  };

  factory Department.fromJson(Map<String, dynamic> j) => Department(
    id: j['id'] as String,
    name: j['name'] as String,
    remark: j['remark'] as String?,
  );
}
