import logging
import random
import uuid
from faker import Faker
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def feel_db(db: AsyncSession) -> None:
    from app.db.models.products import Products
    from app.db.repositories.categories_repo import CategoriesRepository
    from app.db.repositories.products_repo import ProductsRepository
    from app.db.repositories.transactions_repo import TransactionsRepository
    from app.db.repositories.users_repo import UserRepository

    logger.info("Starting database seeding process...")

    result = await db.execute(select(Products).limit(1))
    exists = result.scalar_one_or_none()

    if exists:
        logger.info("Database already contains data. Seeding skipped.")
        return

    logger.info("Database is empty. Initiating data generation...")
    fake = Faker("ru_RU")

    logger.info("Seeding categories...")
    cat_repo = CategoriesRepository(db)
    categories_data = [
        {"name": "Абонентские терминалы (CPE)", "description": "GPON-модемы, IPTV-приставки ZALA, Wi-Fi роутеры"},
        {"name": "Оптические кабели (ВОЛС)", "description": "Магистральные, распределительные и дроп-кабели"},
        {
            "name": "Пассивное оптическое оборудование",
            "description": "Оптические кроссы, муфты, сплиттеры и патч-корды",
        },
        {
            "name": "Сетевое коммутационное оборудование",
            "description": "Управляемые коммутаторы, маршрутизаторы, SFP-модули",
        },
        {"name": "Серверное оборудование и СХД", "description": "Серверные платформы, жесткие диски, стойки"},
        {
            "name": "Линейно-кабельные сооружения",
            "description": "Крепеж, консоли, муфты ЛКС, люки смотровых устройств",
        },
        {"name": "Системы электропитания и ИБП", "description": "Промышленные АКБ для АТС, blocks питания"},
        {"name": "Измерительное оборудование", "description": "Оптические рефлектометры, тестеры, лазерные источники"},
        {"name": "Сварочное оборудование ВОЛС", "description": "Сварочные аппараты, скалыватели, стрипперы"},
        {"name": "Радиооборудование и Wi-Fi", "description": "Точки доступа ByFly, антенно-фидерные устройства"},
    ]
    for el in categories_data:
        await cat_repo.add_categories(name=el["name"], description=el["description"])
    logger.info(f"Successfully seeded {len(categories_data)} categories.")

    logger.info("Seeding users...")
    user_repo = UserRepository(db)
    users_data = [
        {"username": "karpovich_av", "password": "TestPassword123", "phone": "+375291112233"},
        {"username": "ivanov_tech", "password": "TestPassword123", "phone": "+375294445566"},
        {"username": "smirnov_ee", "password": "TestPassword123", "phone": "+375336667788"},
        {"username": "kovalev_w1", "password": "WorkerPassword123", "phone": "+375259990011"},
        {"username": "petrov_splicer", "password": "WorkerPassword123", "phone": "+375297778899"},
        {"username": "novik_gpon", "password": "WorkerPassword123", "phone": "+375333334455"},
        {"username": "kozlov_linear", "password": "WorkerPassword123", "phone": "+375255556677"},
        {"username": "sokolov_clerk", "password": "WorkerPassword123", "phone": "+375292224466"},
    ]

    for i in range(3):
        await user_repo.add_admin(**users_data[i])

    for i in range(3, 8):
        await user_repo.add_worker(**users_data[i])
    logger.info(f"Successfully seeded {len(users_data)} users.")

    logger.info("Generating product templates in memory...")
    TELECOM_PRODUCTS_TEMPLATES = {
        1: {
            "brands": ["Huawei", "ZTE", "Nokia", "Промсвязь"],
            "types": ["GPON ONU", "Wi-Fi Router", "IPTV-приставка ZALA"],
            "models": ["HG8245H", "F660", "G-240W", "Smartlabs SML-5050", "H-108L"],
        },
        2: {
            "brands": ["Инкаб", "Оптикрит", "Белтелекабель", "Сарансккабель"],
            "types": ["Кабель оптический магистральный", "Кабель дроп-оптика", "Кабель подвесной с тросом"],
            "models": ["ОКПБ-М", "ОПД", "ДПТ", "ТОС-08"],
        },
        3: {
            "brands": ["SNR", "Hyperline", "Cabeus", "ТКО"],
            "types": [
                "Оптический кросс ODF 1U",
                "Муфта оптическая тупиковая",
                "Патч-корд LC-SC SM",
                "Сплиттер PLC 1x8",
            ],
            "models": ["24-SFP", "GJS-03", "3м", "9/125"],
        },
        4: {
            "brands": ["Cisco", "Juniper", "D-Link", "Eltex", "Edge-Core"],
            "types": ["Управляемый коммутатор L2", "Маршрутизатор агрегации L3", "SFP+ Модуль 10G"],
            "models": ["Catalyst 2960", "MX240", "DES-3200", "MES2324", "LR-10km"],
        },
        5: {
            "brands": ["HP ProLiant", "Dell PowerEdge", "Lenovo ThinkSystem", "Huawei FusionServer"],
            "types": ["Блейд-сервер 2U", "Система хранения данных (СХД)", "Жесткий диск SAS 2.4TB"],
            "models": ["DL380 Gen10", "R740", "SR650", "2400-v5"],
        },
        6: {
            "brands": ["Минский завод им. Вавилова", "Белсвязькомлект", "Стройтехснаб"],
            "types": ["Консоль КСО-2", "Кронштейн анкерный СА-2000", "Люк чугунный ГТС типа Т"],
            "models": ["ГОСТ 8591", "модифицированный", "с замком"],
        },
        7: {
            "brands": ["Delta", "APC Smart-UPS", "Eaton", "FIAMM"],
            "types": ["Промышленная АКБ 12V 100Ah", "Инвертор питания АТС", "ИБП стоечный 3000VA"],
            "models": ["XRT-12", "SURT3000XLI", "9PX", "FG21003"],
        },
        8: {
            "brands": ["Exfo", "Anritsu", "FOD", "Viavi"],
            "types": ["Оптический рефлектометр (OTDR)", "Измеритель оптической мощности", "Тестер витой пары"],
            "models": ["FTB-1", "FOD-1208", "SmartClass", "MT9083"],
        },
        9: {
            "brands": ["Fujikura", "Sumitomo", "Jilong", "Ilsintech"],
            "types": [
                "Автоматический сварочный аппарат",
                "Прецизионный скалыватель волокна",
                "Стриппер трехпозиционный",
            ],
            "models": ["86S", "TYPE-72C", "KL-21C", "Swift KF4A"],
        },
        10: {
            "brands": ["Ubiquiti", "MikroTik", "Huawei", "Cisco Aironet"],
            "types": ["Точка доступа ByFly Outdoor", "Антенна секторная 5GHz", "Базовая станция Wi-Fi"],
            "models": ["UniFi AC Mesh", "NetMetal 5", "AP7060DN", "2802I"],
        },
    }

    generated_names = set()
    generated_skus = set()
    products_to_seed = []
    count = 500

    for _ in range(count):
        cat_id = random.randint(1, 10)
        template = TELECOM_PRODUCTS_TEMPLATES[cat_id]

        brand = random.choice(template["brands"])
        prod_type = random.choice(template["types"])
        model = random.choice(template["models"])

        if cat_id == 2:
            fibers = random.choice([4, 8, 12, 16, 24, 48, 96])
            name = f"{prod_type} {brand} {model}-{fibers}G.652D"
        else:
            sku_suffix = fake.bothify(text="-##??").upper()
            name = f"{prod_type} {brand} {model}{sku_suffix}"

        if name in generated_names:
            sku_suffix_alt = fake.bothify(text="-###???").upper()
            name = f"{prod_type} {brand} {model}{sku_suffix_alt}"

        generated_names.add(name)

        sku = f"BY-BFT-{fake.bothify(text='#####')}"
        while sku in generated_skus:
            sku = f"BY-BFT-{fake.bothify(text='#####')}"
        generated_skus.add(sku)

        qr_uuid = str(uuid.uuid4())
        initial_qty = random.randint(0, 1500)

        products_to_seed.append(
            {
                "name": name,
                "category_id": cat_id,
                "sku": sku,
                "qr_code_uuid": qr_uuid,
                "initial_quantity": initial_qty,
            }
        )

    logger.info("Saving products and inventory stocks to the database...")
    product_repo = ProductsRepository(db)
    product_data_list = []
    
    for el in products_to_seed:
        prod_obj = await product_repo.create_product_with_stock(**el)
        product_data_list.append({"id": prod_obj.id, "current_qty": el["initial_quantity"]})
    
    logger.info(f"Successfully seeded {len(product_data_list)} products with stock quantities.")

    logger.info("Generating random warehouse transactions...")
    transaction_repo = TransactionsRepository(db)
    transactions_count = 150
    successful_transactions = 0

    for _ in range(transactions_count):
        prod_data = random.choice(product_data_list)
        t_type = random.choice(["incoming", "outgoing"])
        user_id = random.randint(1, 8)

        if t_type == "outgoing":
            qty = random.randint(1, min(10, prod_data["current_qty"] if prod_data["current_qty"] > 1 else 1))
            prod_data["current_qty"] -= qty
        else:
            qty = random.randint(1, 50)
            prod_data["current_qty"] += qty

        try:
            await transaction_repo.add_transaction(
                quantity=qty, transaction_type=t_type, product_id=prod_data["id"], user_id=user_id
            )
            successful_transactions += 1
        except Exception:
            continue

    logger.info(f"Successfully processed {successful_transactions} out of {transactions_count} transactions.")
    logger.info("Database seeding process completed successfully.")