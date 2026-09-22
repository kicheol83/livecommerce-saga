dependencies {
    testImplementation(project(":order-service"))
    testImplementation(project(":payment-service"))
    testImplementation(project(":inventory-service"))
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    testImplementation("org.flywaydb:flyway-core")
    testImplementation("org.flywaydb:flyway-database-postgresql")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("org.testcontainers:kafka")
}

tasks.withType<Test> {
    systemProperty(
        "order.migrations.path",
        file("$rootDir/order-service/src/main/resources/db/migration/order").absolutePath.replace("\\", "/")
    )
    systemProperty(
        "payment.migrations.path",
        file("$rootDir/payment-service/src/main/resources/db/migration/payment").absolutePath.replace("\\", "/")
    )
    systemProperty(
        "inventory.migrations.path",
        file("$rootDir/inventory-service/src/main/resources/db/migration/inventory").absolutePath.replace("\\", "/")
    )
}
