import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { observer } from "mobx-react-lite";
import { makeAutoObservable, runInAction } from "mobx";
import axios from "axios";
import dayjs from "dayjs";
import clsx from "clsx";
import {
  App as AntApp,
  Button,
  Card,
  ConfigProvider,
  DatePicker,
  Form,
  Input,
  Layout,
  Modal,
  Select,
  Space,
  Table,
  TimePicker,
  Typography,
} from "antd";
import "antd/dist/reset.css";
import "./style.css";
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000",
  withCredentials: true,
});
api.interceptors.response.use(
  (x) => x,
  (e) => Promise.reject(new Error(e.response?.data?.message || e.message)),
);
type Device = {
  id: number;
  name: string;
  responsible?: string;
  housing?: string;
  room?: string;
};
type Protocol = { id: number; name: string };
type Reservation = {
  id: number;
  owner: string;
  starttime: string;
  endtime: string;
  comment?: string;
  deviceId: number;
  protocolId: number;
};
class Store {
  devices: Device[] = [];
  protocols: Protocol[] = [];
  reservations: Reservation[] = [];
  date = dayjs();
  deviceId?: number;
  loading = false;
  constructor() {
    makeAutoObservable(this);
  }
  async init() {
    try {
      const [d, p] = await Promise.all([
        api.get<Device[]>("/api/devices"),
        api.get<Protocol[]>("/api/protocols"),
      ]);
      runInAction(() => {
        this.devices = d.data;
        this.protocols = p.data;
        this.deviceId = d.data[0]?.id;
      });
      await this.load();
    } catch (e) {
      throw e;
    }
  }
  async load() {
    this.loading = true;
    try {
      const r = await api.get<Reservation[]>("/api/reservations", {
        params: {
          deviceId: this.deviceId,
          from: this.date.startOf("day").format("YYYY-MM-DDTHH:mm:ss"),
          to: this.date
            .add(1, "day")
            .startOf("day")
            .format("YYYY-MM-DDTHH:mm:ss"),
        },
      });
      runInAction(() => {
        this.reservations = r.data;
      });
    } finally {
      runInAction(() => {
        this.loading = false;
      });
    }
  }
}
const store = new Store();
const Calendar = observer(() => {
  const { message } = AntApp.useApp();
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();
  useEffect(() => {
    store.init().catch((e) => message.error(e.message));
  }, []);
  const show = (r?: Reservation) => {
    setEditing(r || null);
    form.setFieldsValue({
      protocolId: r?.protocolId,
      comment: r?.comment,
      start: dayjs(r?.starttime || store.date.hour(8).minute(0)),
      end: dayjs(r?.endtime || store.date.hour(9).minute(0)),
    });
    setOpen(true);
  };
  const save = async (v: any) => {
    try {
      const body = {
        deviceId: store.deviceId,
        protocolId: v.protocolId,
        start: store.date
          .hour(v.start.hour())
          .minute(v.start.minute())
          .second(0)
          .format("YYYY-MM-DDTHH:mm:ss"),
        end: store.date
          .hour(v.end.hour())
          .minute(v.end.minute())
          .second(0)
          .format("YYYY-MM-DDTHH:mm:ss"),
        comment: v.comment,
      };
      if (editing) await api.put(`/api/reservations/${editing.id}`, body);
      else await api.post("/api/reservations", body);
      setOpen(false);
      await store.load();
      message.success("Сохранено");
    } catch (e: any) {
      message.error(e.message);
    }
  };
  return (
    <Card
      title="Бронирование оборудования"
      extra={
        <Space>
          <Button
            onClick={() => store.load().catch((e) => message.error(e.message))}
          >
            Обновить
          </Button>
          <Button
            type="primary"
            disabled={!store.deviceId}
            onClick={() => show()}
          >
            Создать бронь
          </Button>
        </Space>
      }
    >
      <Space wrap style={{ marginBottom: 20 }}>
        <Select
          style={{ width: 260 }}
          placeholder="Оборудование"
          value={store.deviceId}
          options={store.devices.map((d) => ({ value: d.id, label: d.name }))}
          onChange={(v) => {
            store.deviceId = v;
            store.load().catch((e) => message.error(e.message));
          }}
        />
        <DatePicker
          value={store.date}
          disabledDate={(d) => d.isAfter(dayjs(), "day")}
          onChange={(v) => {
            if (v) {
              store.date = v;
              store.load().catch((e) => message.error(e.message));
            }
          }}
        />
        <Link to="/devices">Редактировать оборудование</Link>
      </Space>
      <Table
        rowKey="id"
        loading={store.loading}
        dataSource={store.reservations}
        columns={[
          {
            title: "Начало",
            dataIndex: "starttime",
            render: (v) => dayjs(v).format("HH:mm"),
          },
          {
            title: "Окончание",
            dataIndex: "endtime",
            render: (v) => dayjs(v).format("HH:mm"),
          },
          { title: "Владелец", dataIndex: "owner" },
          {
            title: "Протокол",
            dataIndex: "protocolId",
            render: (v) => store.protocols.find((p) => p.id === v)?.name || v,
          },
          {
            title: "Действия",
            render: (_, r) => (
              <Button className={clsx("edit-action")} onClick={() => show(r)}>
                Открыть
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? "Изменение бронирования" : "Новое бронирование"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        okText="Сохранить"
      >
        <Form form={form} layout="vertical" onFinish={save}>
          <Form.Item name="start" label="Начало" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" />
          </Form.Item>
          <Form.Item name="end" label="Окончание" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" />
          </Form.Item>
          <Form.Item
            name="protocolId"
            label="Протокол"
            rules={[{ required: true }]}
          >
            <Select
              options={store.protocols.map((p) => ({
                value: p.id,
                label: p.name,
              }))}
            />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий">
            <Input.TextArea />
          </Form.Item>
        </Form>
        {editing && (
          <Button
            danger
            onClick={async () => {
              try {
                await api.delete(`/api/reservations/${editing.id}`);
                setOpen(false);
                await store.load();
              } catch (e: any) {
                message.error(e.message);
              }
            }}
          >
            Удалить бронь
          </Button>
        )}
      </Modal>
    </Card>
  );
});
const Devices = observer(() => {
  const { message } = AntApp.useApp();
  const [editing, setEditing] = useState<Device | null>(null);
  const [form] = Form.useForm();
  return (
    <Card title="Оборудование" extra={<Link to="/">К календарю</Link>}>
      <Table
        rowKey="id"
        dataSource={store.devices}
        columns={[
          { title: "Название", dataIndex: "name" },
          { title: "Ответственный", dataIndex: "responsible" },
          { title: "Корпус", dataIndex: "housing" },
          { title: "Помещение", dataIndex: "room" },
          {
            title: "",
            render: (_, d) => (
              <Button
                onClick={() => {
                  setEditing(d);
                  form.setFieldsValue(d);
                }}
              >
                Изменить
              </Button>
            ),
          },
        ]}
      />
      <Modal
        title="Редактирование оборудования"
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (v) => {
            try {
              await api.put(`/api/devices/${editing?.id}`, v);
              await store.init();
              setEditing(null);
            } catch (e: any) {
              message.error(e.message);
            }
          }}
        >
          {["name", "responsible", "housing", "room"].map((k) => (
            <Form.Item
              key={k}
              name={k}
              label={
                {
                  name: "Название",
                  responsible: "Ответственный",
                  housing: "Корпус",
                  room: "Помещение",
                }[k]
              }
            >
              <Input />
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </Card>
  );
});
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider locale={undefined}>
      <AntApp>
        <BrowserRouter>
          <Layout style={{ minHeight: "100vh", padding: 24 }}>
            <Typography.Title level={3}>SchedulerPCR</Typography.Title>
            <Routes>
              <Route path="/" element={<Calendar />} />
              <Route path="/devices" element={<Devices />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
