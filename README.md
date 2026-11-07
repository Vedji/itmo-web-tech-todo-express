# ToDO App

## ФИО и логин

ФИО: `Понкратов Никоалй Александрович`
Логин Moodle: `ponkratov_na`

## Сравнение вариантов размещения

|  **Хостинг**  | **Цена месяц/рублей** | **Ядра** | **Ram, GB** | **Диск** |
|:-------------:|:---------------------:|:--------:|-------------|----------|
|  firstvps.ru  |          950          |     2    |      2      |    20    |
|  selectel.ru  |          2190         |     1    |      1      |     5    |
| timeweb.cloud |          1000         |     2    |      2      |    40    |

Для размещения проекта был выбран `timeweb.cloud`.

## Первый запуск

### Клонирования репозитория 

```
git clone https://github.com/Vedji/itmo-web-tech-todo-express
cd itmo-web-tech-todo-express
```

### Переменные окружения

```
cp .env.example .env
```

Пример заполненного `.env`

```
PORT=3000
MOODLE_LOGIN=ponkratov_na
MOODLE_FULL_NAME=Фамилия Имя
API_TOKEN=secret-token

MONGO_ROOT_USER=admin
MONGO_ROOT_PASSWORD=root123456

MONGODB_URI=mongodb://todo_app_user:app123456@mongo:27017/todo_app?authSource=todo_app
MONGODB_DB=todo_app
```

### Запуск Docker


```
docker compose up -d --build
```

### Первоначальная настройка MongoDB

Открыть терминал MongoDB

```
docker compose exec mongo mongo -u admin -p root123456 --authenticationDatabase admin todo_app
```

Добавить пользователя

```
db.createRole({
  role: 'tasksApp',
  privileges: [{
    resource: { db: 'todo_app', collection: 'tasks' },
    actions: ['find', 'insert', 'update', 'remove', 'createIndex']
  }],
  roles: []
});

db.createUser({
  user: 'todo_app_user',
  pwd: 'app123456',
  roles: [{ role: 'tasksApp', db: 'todo_app' }]
});
```

## Используемые технологии

| **Название** |    **Описание**   |
|:------------:|:-----------------:|
|    Node.js   |         22        |
|    Express   |       4.21.2      |
|    MongoDB   |        4.4        |

## Схема данных

В приложении используется база данных MongoDB. Задачи храняться в колекции `tasks`.

|  **Поле**  |   **Тип данных**  |           **Описание**           |
|:----------:|:-----------------:|:--------------------------------:|
|     _id    |      ObjectId     | Внутренний идентификатор MongoDB |
| id         | String (UUID)     | Уникальный идентификатор задачи  |
| ownerLogin | String            | Логин                            |
| title      | String            | Название задачи                  |
| done       | Boolean           | Статус выполнения задачи         |
| runId      | String            | Идентификатор набора задач       |
| createdAt  | String (ISO 8601) | Дата и время создания задачи     |