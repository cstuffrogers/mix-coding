class Person {
  final String id;
  final String name;
  final String departmentId;
  final String? remark;

  Person({
    required this.id,
    required this.name,
    required this.departmentId,
    this.remark,
  });

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'departmentId': departmentId,
    'remark': remark,
  };

  factory Person.fromJson(Map<String, dynamic> j) => Person(
    id: j['id'] as String,
    name: j['name'] as String,
    departmentId: j['departmentId'] as String,
    remark: j['remark'] as String?,
  );
}
