# Regras do ProGuard para Assistente de Balança
-keepattributes *Annotation*
-keepclassmembers class * {
    @androidx.room.Dao *;
    @androidx.room.Entity *;
}
